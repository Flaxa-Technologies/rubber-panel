"use client";

import { createContext, useContext } from "react";
import type { UserServer } from "@/lib/types";

interface ServerContextType {
  server: UserServer;
  refreshServer: () => Promise<void>;
}

const ServerContext = createContext<ServerContextType | null>(null);

export function ServerProvider({
  server,
  refreshServer,
  children,
}: {
  server: UserServer;
  refreshServer: () => Promise<void>;
  children: React.ReactNode;
}) {
  return (
    <ServerContext.Provider value={{ server, refreshServer }}>
      {children}
    </ServerContext.Provider>
  );
}

export function useServer() {
  const ctx = useContext(ServerContext);
  if (!ctx) throw new Error("useServer must be used within ServerProvider");
  return ctx;
}
