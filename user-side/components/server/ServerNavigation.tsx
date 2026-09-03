"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Terminal, FolderOpen, Network, Archive, Settings,
  Users, Clock, Blocks, Sliders, Webhook, ArrowLeftRight, Code2, Database
} from "lucide-react";
import { useServer } from "@/components/server/ServerContext";

const baseTabs = [
  { name: "Console", path: "console", icon: Terminal },
  { name: "Files", path: "files", icon: FolderOpen },
  { name: "Databases", path: "databases", icon: Database },
  { name: "Addons", path: "addons", icon: Blocks },
  { name: "Properties", path: "properties", icon: Sliders },
  { name: "Schedules", path: "schedules", icon: Clock },
  { name: "Users", path: "users", icon: Users },
  { name: "Connections", path: "connections", icon: Webhook },
  { name: "Network", path: "network", icon: Network },
  { name: "Backups", path: "backups", icon: Archive },
  { name: "Settings", path: "settings", icon: Settings },
];

export default function ServerNavigation({ serverId }: { serverId: string }) {
  const pathname = usePathname();
  const { server } = useServer();

  const isSandbox = (server?.isSandbox || server?.serverType === "CODESANDBOX") && server?.serverType !== "MINECRAFT";
  const isNodeJs = server?.serverType === "NODEJS" || server?.software?.type === "NODEJS";
  const isDatabase = server?.serverType === "DATABASE" || server?.software?.type === "DATABASE";
  
  // Filter tabs for Code Sandbox / Node.js / Database vs Minecraft
  let tabs = baseTabs.filter(tab => {
    if ((isSandbox || isNodeJs || isDatabase) && (tab.path === "addons" || tab.path === "properties")) {
      return false;
    }
    return true;
  });

  // Show Transfer tab if enabled by administration
  if (server?.allowNodeTransfer) {
    // Insert Transfer tab right before Settings
    tabs.splice(tabs.length - 1, 0, {
      name: "Transfer",
      path: "transfer",
      icon: ArrowLeftRight,
    });
  }

  return (
    <div className="saas-tab-strip">
      {tabs.map((tab) => {
        const href = `/servers/${serverId}/${tab.path}`;
        const active = pathname.startsWith(href) || (pathname === `/servers/${serverId}` && tab.path === "console");
        const Icon = tab.icon;

        return (
          <Link 
            key={tab.name} 
            href={href} 
            className={`saas-tab-item ${active ? "active" : ""}`}
          >
            <Icon size={14} style={{ opacity: active ? 1 : 0.6 }} />
            <span>{tab.name}</span>
          </Link>
        );
      })}
    </div>
  );
}
