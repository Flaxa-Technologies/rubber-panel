import db from "@/lib/db";
import { sendNodeCommand } from "@/lib/node-client";

export interface GitHubReleaseAsset {
  name: string;
  browser_download_url: string;
  size: number;
  digest?: string; // e.g. "sha256:eced1b695b5293b938a9a122d6ab2cd81b787cb096222621b07052c9febccfe0"
  updated_at?: string;
}

export interface GitHubRelease {
  id: number;
  tag_name: string;
  name: string;
  body: string;
  target_commitish: string;
  draft: boolean;
  prerelease: boolean;
  created_at: string;
  updated_at: string;
  published_at: string;
  assets: GitHubReleaseAsset[];
}

// Helper to fetch GitHub releases with rate limit handling & timeout
async function fetchPumpkinReleasesFromGitHub(): Promise<GitHubRelease[]> {
  const url = "https://api.github.com/repos/Pumpkin-MC/Pumpkin/releases";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);
    const headers: Record<string, string> = {
      "User-Agent": "RubberPanel/2.0 (Pumpkin-MC Version Provider)",
      "Accept": "application/vnd.github+json",
    };
    if (process.env.GITHUB_TOKEN) {
      headers["Authorization"] = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    const res = await fetch(url, { headers, signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) {
      console.warn(`[PumpkinService] GitHub API returned status ${res.status}`);
      return [];
    }
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (err: any) {
    console.warn(`[PumpkinService] Failed to fetch releases from GitHub:`, err?.message);
    return [];
  }
}

// Extract SHA-256 hex string from GitHub digest format "sha256:abcdef..."
function extractSha256(digest?: string): string | null {
  if (!digest) return null;
  const match = digest.match(/sha256:([a-fA-F0-9]{64})/);
  return match ? match[1].toLowerCase() : null;
}

// Main Version Discovery & Synchronization Engine
export async function syncPumpkinReleases(): Promise<{
  newBuildsFound: number;
  latestNightlyCommit: string | null;
  builds: any[];
}> {
  console.log("[PumpkinService] Checking Pumpkin-MC/Pumpkin GitHub releases...");
  const releases = await fetchPumpkinReleasesFromGitHub();
  if (!releases.length) {
    // Fallback: return existing builds from DB
    const existing = await db.pumpkinBuild.findMany({ orderBy: { createdAt: "desc" } });
    return {
      newBuildsFound: 0,
      latestNightlyCommit: existing.find(b => b.isLatest)?.commitSha || null,
      builds: existing,
    };
  }

  // Ensure "Pumpkin" software entry exists
  let pumpkinSoftware = await db.software.findFirst({ where: { name: "Pumpkin" } });
  if (!pumpkinSoftware) {
    pumpkinSoftware = await db.software.create({
      data: {
        name: "Pumpkin",
        type: "PUMPKIN",
        description: "Blazing fast, multithreaded Minecraft server written entirely in Rust with native Java & Bedrock support.",
        logoUrl: "https://pumpkinmc.org/assets/icon.svg",
      },
    });
  } else {
    await db.software.update({
      where: { id: pumpkinSoftware.id },
      data: {
        type: "PUMPKIN",
        description: "Blazing fast, multithreaded Minecraft server written entirely in Rust with native Java & Bedrock support.",
      },
    });
  }

  let newBuildsCount = 0;
  let latestNightlyCommit: string | null = null;

  // Process all releases (Nightly + Stable Tags)
  for (const rel of releases) {
    const isNightly = rel.tag_name === "nightly";
    const body = rel.body || "";

    // 1. Extract Commit SHA
    let commitSha = "";
    const commitMatch = body.match(/commit:\s*([a-f0-9]{7,40})/i);
    if (commitMatch) {
      commitSha = commitMatch[1].slice(0, 7);
    } else if (rel.target_commitish && rel.target_commitish !== "master" && rel.target_commitish !== "main") {
      commitSha = rel.target_commitish.slice(0, 7);
    } else {
      commitSha = rel.id.toString().slice(-7);
    }

    // 2. Extract Generation / Publish Date
    let generatedAt: Date = new Date(rel.published_at || rel.created_at || Date.now());
    const genMatch = body.match(/Generated on:\s*([^\n\r]+)/i);
    if (genMatch) {
      const parsed = new Date(genMatch[1].trim());
      if (!isNaN(parsed.getTime())) generatedAt = parsed;
    }

    // 3. Extract Minecraft Java & Bedrock Version Info where available
    let javaVersion = "1.21.4";
    let bedrockVersion = "1.21.50";
    const javaMatch = body.match(/Java(?:\s*Edition|\s*MC|\s*Minecraft)?:\s*([0-9.]+)/i);
    if (javaMatch) javaVersion = javaMatch[1];
    const bedrockMatch = body.match(/Bedrock(?:\s*Edition|\s*MC|\s*Minecraft)?:\s*([0-9.]+)/i);
    if (bedrockMatch) bedrockVersion = bedrockMatch[1];

    // 4. Unique immutable version identifier
    const versionId = isNightly ? `pumpkin-nightly-${commitSha}` : `pumpkin-${rel.tag_name}`;
    if (isNightly) latestNightlyCommit = commitSha;

    // 5. Select native glibc Linux binaries (X64 and ARM64) — avoid musl, android, macos, windows
    const x64Asset = rel.assets?.find(a => a.name === "pumpkin-X64-Linux");
    const arm64Asset = rel.assets?.find(a => a.name === "pumpkin-ARM64-Linux");

    const x64Url = x64Asset?.browser_download_url || null;
    const x64Sha256 = extractSha256(x64Asset?.digest);
    const x64Size = x64Asset?.size || null;

    const arm64Url = arm64Asset?.browser_download_url || null;
    const arm64Sha256 = extractSha256(arm64Asset?.digest);
    const arm64Size = arm64Asset?.size || null;

    // Check if build already exists in DB
    const existingBuild = await db.pumpkinBuild.findUnique({ where: { versionId } });

    if (!existingBuild) {
      newBuildsCount++;
      // Determine versionSequence
      const allBuilds = await db.pumpkinBuild.findMany({ select: { versionSequence: true } });
      const seqIndex = allBuilds.length;
      const versionSequence = `1.0.${seqIndex}`;

      // If this is the newest nightly, mark previous latest as outdated
      if (isNightly) {
        await db.pumpkinBuild.updateMany({
          where: { isNightly: true, isLatest: true },
          data: { isLatest: false, isOutdated: true },
        });
      }

      await db.pumpkinBuild.create({
        data: {
          versionId,
          commitSha,
          tag: rel.tag_name,
          versionSequence,
          javaVersion,
          bedrockVersion,
          generatedAt,
          publishedAt: new Date(rel.published_at || rel.created_at || Date.now()),
          isNightly,
          isLatest: isNightly,
          isOutdated: false,
          x64Url,
          x64Sha256,
          x64Size,
          arm64Url,
          arm64Sha256,
          arm64Size,
          syncedNodes: "[]",
        },
      });

      // Upsert into standard SoftwareVersion table for compatibility with all panel dropdowns
      await db.softwareVersion.upsert({
        where: { softwareId_version: { softwareId: pumpkinSoftware.id, version: versionId } },
        update: {
          buildNumber: commitSha,
          downloadUrl: x64Url,
          releaseDate: generatedAt,
          isStable: !isNightly,
        },
        create: {
          softwareId: pumpkinSoftware.id,
          version: versionId,
          buildNumber: commitSha,
          downloadUrl: x64Url,
          releaseDate: generatedAt,
          isStable: !isNightly,
        },
      });
    } else {
      // Update metadata (URLs, digests) in case GitHub updated asset digests
      await db.pumpkinBuild.update({
        where: { id: existingBuild.id },
        data: {
          x64Url: x64Url || existingBuild.x64Url,
          x64Sha256: x64Sha256 || existingBuild.x64Sha256,
          x64Size: x64Size || existingBuild.x64Size,
          arm64Url: arm64Url || existingBuild.arm64Url,
          arm64Sha256: arm64Sha256 || existingBuild.arm64Sha256,
          arm64Size: arm64Size || existingBuild.arm64Size,
          javaVersion,
          bedrockVersion,
        },
      });
    }
  }

  // Also ensure at least one build is marked isLatest
  const latest = await db.pumpkinBuild.findFirst({
    where: { isNightly: true },
    orderBy: { generatedAt: "desc" },
  });
  if (latest && !latest.isLatest) {
    await db.pumpkinBuild.updateMany({ where: { isLatest: true }, data: { isLatest: false } });
    await db.pumpkinBuild.update({ where: { id: latest.id }, data: { isLatest: true, isOutdated: false } });
  }

  const allUpdated = await db.pumpkinBuild.findMany({ orderBy: [{ isLatest: "desc" }, { generatedAt: "desc" }] });
  return {
    newBuildsFound: newBuildsCount,
    latestNightlyCommit,
    builds: allUpdated,
  };
}

// Retrieve Pumpkin build catalog with node distribution matrix
export async function getPumpkinCatalog() {
  const [builds, nodes, software, runningServers] = await Promise.all([
    db.pumpkinBuild.findMany({ orderBy: [{ isLatest: "desc" }, { generatedAt: "desc" }] }),
    db.node.findMany({ select: { id: true, name: true, status: true, fqdn: true } }),
    db.software.findFirst({ where: { name: "Pumpkin" }, include: { versions: true } }),
    db.server.findMany({
      where: {
        OR: [
          { software: { name: "Pumpkin" } },
          { serverType: "PUMPKIN" },
        ],
      },
      select: {
        id: true,
        name: true,
        status: true,
        nodeId: true,
        softwareVersionId: true,
        softwareVersion: { select: { version: true, buildNumber: true } },
        node: { select: { id: true, name: true } },
      },
    }),
  ]);

  return {
    software,
    builds,
    nodes,
    runningServers,
    latestBuild: builds.find(b => b.isLatest) || builds[0] || null,
  };
}

// Distribute / Sync a specific Pumpkin build to all online nodes
export async function syncPumpkinBuildToNodes(versionId: string) {
  const build = await db.pumpkinBuild.findUnique({ where: { versionId } });
  if (!build) throw new Error(`Pumpkin build "${versionId}" not found`);

  const nodes = await db.node.findMany({
    where: { status: "ONLINE" },
    select: { id: true, name: true, fqdn: true, port: true },
  });

  const syncedNodeIds: string[] = [];
  try {
    const existing = JSON.parse(build.syncedNodes || "[]");
    if (Array.isArray(existing)) syncedNodeIds.push(...existing);
  } catch {}

  const results: { nodeId: string; nodeName: string; success: boolean; message?: string }[] = [];

  for (const node of nodes) {
    try {
      console.log(`[PumpkinService] Dispatching build ${versionId} (${build.commitSha}) sync to node ${node.name}...`);
      const res = await sendNodeCommand(node.id, "/api/agent/software/pumpkin/sync", "POST", {
        versionId: build.versionId,
        commitSha: build.commitSha,
        x64Url: build.x64Url,
        x64Sha256: build.x64Sha256,
        arm64Url: build.arm64Url,
        arm64Sha256: build.arm64Sha256,
      });

      if (res.success) {
        if (!syncedNodeIds.includes(node.id)) syncedNodeIds.push(node.id);
        results.push({ nodeId: node.id, nodeName: node.name, success: true });
      } else {
        results.push({ nodeId: node.id, nodeName: node.name, success: false, message: res.error || "Failed on agent" });
      }
    } catch (err: any) {
      results.push({ nodeId: node.id, nodeName: node.name, success: false, message: err?.message });
    }
  }

  await db.pumpkinBuild.update({
    where: { id: build.id },
    data: { syncedNodes: JSON.stringify(syncedNodeIds) },
  });

  return {
    versionId,
    commitSha: build.commitSha,
    results,
    syncedNodesCount: syncedNodeIds.length,
    totalOnlineNodes: nodes.length,
  };
}
