import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "radlus.com",
    "admin.radlus.com",
    "seller.radlus.com",
    "*.radlus.com",
    "*.loca.lt",
    "twenty-doors-juggle.loca.lt",
    "*.ngrok-free.app",
    "*.ngrok.app",
    "*.trycloudflare.com",
    "*.app.github.dev",
    "localhost",
    "127.0.0.1",
    "192.168.1.2",
  ],
  images: {
    unoptimized: true,
  },
  async headers() {
    return [
      {
        source: "/api/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,PUT,DELETE,OPTIONS,PATCH" },
          { key: "Access-Control-Allow-Headers", value: "X-Requested-With, Content-Type, Authorization, x-internal-secret, x-user-id, X-Rubber-Panel, Bypass-Tunnel-Reminder" },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3000",
        "localhost:3001",
        "localhost:3002",
        "radlus.com",
        "*.radlus.com",
        "admin.radlus.com",
        "seller.radlus.com",
        "*.loca.lt",
        "twenty-doors-juggle.loca.lt",
        "*.ngrok-free.app",
        "*.ngrok.app",
        "*.trycloudflare.com",
        "*.app.github.dev",
      ],
    },
  },
};

export default nextConfig;
