import { NextRequest, NextResponse } from "next/server";
import { verifyAgentToken } from "@/lib/auth";
import {
  testSftpConnection,
  previewPullManifest,
  startPullJob,
  startTransferJob,
  getJobStatus,
  SftpConnectionConfig,
} from "@/lib/remote-sftp-manager";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const jobId = searchParams.get("jobId");

  if (!jobId) {
    return NextResponse.json({ error: "Missing jobId parameter" }, { status: 400 });
  }

  const job = getJobStatus(jobId);
  if (!job || job.serverId !== id) {
    return NextResponse.json({ error: "Job not found" }, { status: 404 });
  }

  return NextResponse.json({ job });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!verifyAgentToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const action = body.action;

    if (!action) {
      return NextResponse.json({ error: "Missing action parameter" }, { status: 400 });
    }

    const config: SftpConnectionConfig = {
      host: body.host || "",
      port: body.port ? parseInt(body.port) : 22,
      username: body.username || "",
      password: body.password || undefined,
      privateKey: body.privateKey || undefined,
      passphrase: body.passphrase || undefined,
      remotePath: body.remotePath || "/",
    };

    if (!config.host || !config.username) {
      return NextResponse.json({ error: "Remote host and username are required" }, { status: 400 });
    }

    if (action === "test") {
      const result = await testSftpConnection(config);
      return NextResponse.json(result);
    }

    if (action === "preview-pull") {
      const result = await previewPullManifest({
        serverId: id,
        config,
        preservePaths: body.preservePaths,
        excludePaths: body.excludePaths,
        wipeExisting: body.wipeExisting !== false,
      });
      return NextResponse.json(result);
    }

    if (action === "pull") {
      const result = startPullJob({
        serverId: id,
        config,
        preservePaths: body.preservePaths,
        excludePaths: body.excludePaths,
        wipeExisting: body.wipeExisting !== false,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === "transfer") {
      const result = startTransferJob({
        serverId: id,
        config,
        excludePaths: body.excludePaths,
      });
      return NextResponse.json({ success: true, ...result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Failed to process SFTP request" }, { status: 500 });
  }
}
