import db from "./db";

export interface GoogleDriveConfig {
  configured: boolean;
  clientId?: string;
  clientSecret?: string;
}

export async function getGoogleDriveConfig(): Promise<GoogleDriveConfig> {
  try {
    const settings = await db.setting.findMany({
      where: {
        key: {
          in: ["gdrive.clientId", "gdrive.clientSecret", "gdrive.enabled"],
        },
      },
    });

    const configMap = new Map(settings.map((s) => [s.key, s.value]));
    const clientId = configMap.get("gdrive.clientId");
    const clientSecret = configMap.get("gdrive.clientSecret");
    const enabled = configMap.get("gdrive.enabled") === "true";

    return {
      configured: Boolean(enabled && clientId && clientSecret),
      clientId: clientId || undefined,
      clientSecret: clientSecret || undefined,
    };
  } catch (err) {
    console.error("[getGoogleDriveConfig] Error:", err);
    return { configured: false };
  }
}

export async function saveGoogleDriveConfig(clientId: string, clientSecret?: string): Promise<boolean> {
  try {
    await db.setting.upsert({
      where: { key: "gdrive.clientId" },
      create: { key: "gdrive.clientId", value: clientId.trim(), group: "gdrive" },
      update: { value: clientId.trim() },
    });

    if (clientSecret && clientSecret.trim()) {
      await db.setting.upsert({
        where: { key: "gdrive.clientSecret" },
        create: { key: "gdrive.clientSecret", value: clientSecret.trim(), group: "gdrive" },
        update: { value: clientSecret.trim() },
      });
    }

    await db.setting.upsert({
      where: { key: "gdrive.enabled" },
      create: { key: "gdrive.enabled", value: "true", group: "gdrive" },
      update: { value: "true" },
    });

    return true;
  } catch (err) {
    console.error("[saveGoogleDriveConfig] Error:", err);
    return false;
  }
}

export async function getGoogleOAuthAuthUrl(redirectUri: string, state: string): Promise<string | null> {
  const config = await getGoogleDriveConfig();
  if (!config.configured || !config.clientId) return null;

  const scopes = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ].join(" ");

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scopes,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

export async function exchangeGoogleAuthCode(code: string, redirectUri: string) {
  const config = await getGoogleDriveConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google Drive OAuth is not configured on the panel.");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: config.clientId,
      client_secret: config.clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || data.error || "Failed to exchange Google OAuth code");
  }

  return {
    accessToken: data.access_token as string,
    refreshToken: data.refresh_token as string | undefined,
    expiresIn: data.expires_in as number,
  };
}

export async function refreshGoogleAccessToken(refreshToken: string) {
  const config = await getGoogleDriveConfig();
  if (!config.clientId || !config.clientSecret) {
    throw new Error("Google Drive OAuth credentials missing");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error_description || "Failed to refresh Google access token");
  }

  return {
    accessToken: data.access_token as string,
    expiresIn: data.expires_in as number,
  };
}

export async function getValidUserGoogleAccessToken(userId: string): Promise<string | null> {
  const record = await db.userGoogleDriveToken.findUnique({
    where: { userId },
  });

  if (!record || !record.accessToken) return null;

  // Check if token is still valid (with 5-minute buffer)
  const isExpired = record.tokenExpiry ? new Date(record.tokenExpiry).getTime() - 5 * 60 * 1000 < Date.now() : false;

  if (!isExpired) {
    return record.accessToken;
  }

  if (!record.refreshToken) {
    return null;
  }

  try {
    const refreshed = await refreshGoogleAccessToken(record.refreshToken);
    const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000);

    await db.userGoogleDriveToken.update({
      where: { userId },
      data: {
        accessToken: refreshed.accessToken,
        tokenExpiry: newExpiry,
      },
    });

    return refreshed.accessToken;
  } catch (err) {
    console.error("[getValidUserGoogleAccessToken] Failed to refresh token:", err);
    return null;
  }
}

export async function getOrCreateDriveFolder(accessToken: string, folderName = "RubberPanel-Backups"): Promise<string> {
  // Check if folder exists
  const query = encodeURIComponent(`name = '${folderName}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`);
  const listRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (listRes.ok) {
    const data = await listRes.json();
    if (data.files && data.files.length > 0) {
      return data.files[0].id;
    }
  }

  // Create folder
  const createRes = await fetch("https://www.googleapis.com/drive/v3/files", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: "application/vnd.google-apps.folder",
    }),
  });

  if (!createRes.ok) {
    throw new Error("Failed to create RubberPanel-Backups directory in Google Drive");
  }

  const created = await createRes.json();
  return created.id;
}

export async function uploadFileToGoogleDrive(
  accessToken: string,
  fileName: string,
  fileBuffer: Buffer,
  mimeType = "application/zip",
  folderName = "RubberPanel-Backups"
) {
  const folderId = await getOrCreateDriveFolder(accessToken, folderName);

  const metadata = {
    name: fileName,
    parents: [folderId],
    mimeType,
  };

  const boundary = "-------314159265358979323846";
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const metaHeader = `Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}`;
  const mediaHeader = `Content-Type: ${mimeType}\r\n\r\n`;

  const bodyBuffer = Buffer.concat([
    Buffer.from(delimiter + metaHeader + delimiter + mediaHeader),
    fileBuffer,
    Buffer.from(closeDelimiter),
  ]);

  const uploadRes = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,webContentLink,size", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": `multipart/related; boundary=${boundary}`,
      "Content-Length": bodyBuffer.length.toString(),
    },
    body: bodyBuffer,
  });

  if (!uploadRes.ok) {
    const errorText = await uploadRes.text();
    throw new Error(`Google Drive upload failed (${uploadRes.status}): ${errorText}`);
  }

  const data = await uploadRes.json();
  return {
    fileId: data.id as string,
    webViewLink: (data.webViewLink || data.webContentLink) as string,
    size: parseInt(data.size || fileBuffer.length.toString()),
  };
}

export async function deleteFileFromGoogleDrive(accessToken: string, fileId: string): Promise<boolean> {
  try {
    const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.ok || res.status === 404;
  } catch (err) {
    console.error("[deleteFileFromGoogleDrive] Error:", err);
    return false;
  }
}

export async function downloadFileFromGoogleDrive(accessToken: string, fileId: string): Promise<Buffer> {
  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Failed to download backup from Google Drive (${res.status})`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function getGoogleDriveAccountDetails(accessToken: string) {
  try {
    const [userRes, aboutRes] = await Promise.all([
      fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
      fetch("https://www.googleapis.com/drive/v3/about?fields=storageQuota,user", {
        headers: { Authorization: `Bearer ${accessToken}` },
      }),
    ]);

    let email = "";
    let name = "";
    let storageTotal = 0;
    let storageUsed = 0;

    if (userRes.ok) {
      const u = await userRes.json();
      email = u.email || "";
      name = u.name || "";
    }

    if (aboutRes.ok) {
      const a = await aboutRes.json();
      if (a.storageQuota) {
        storageTotal = parseInt(a.storageQuota.limit || "0");
        storageUsed = parseInt(a.storageQuota.usage || "0");
      }
    }

    return { email, name, storageTotal, storageUsed };
  } catch (err) {
    return { email: "", name: "", storageTotal: 0, storageUsed: 0 };
  }
}
