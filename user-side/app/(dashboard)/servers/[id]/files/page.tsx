"use client";

import { useServer } from "@/components/server/ServerContext";
import FileManagerPanel from "@/components/server/FileManagerPanel";

export default function FilesPage() {
  const { server } = useServer();
  return (
    <FileManagerPanel
      serverId={server.id}
      allowedPaths={server.allowedPaths}
      protectedPaths={server.protectedPaths}
      blockedUploadPaths={server.blockedUploadPaths}
    />
  );
}
