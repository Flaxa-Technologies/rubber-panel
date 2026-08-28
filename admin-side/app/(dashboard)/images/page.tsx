"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Box, Search, Download, Plus, CheckCircle2, Trash2, ExternalLink,
  Layers, Terminal, Check, X, Server, HardDrive, Database, Code,
  Sparkles, RefreshCw, Sliders, Cpu, Zap, Shield, Globe, Play, Copy,
  Filter, AlertCircle, Info, ArrowUpRight, Activity, ArrowRight,
  ChevronRight, Laptop, Gamepad2, Settings, ShieldCheck, Flame
} from "lucide-react";

interface ContainerImageItem {
  id: string;
  name: string;
  category: "RUNTIME" | "DATABASE" | "WEB" | "CUSTOM" | "GAME" | "TOOL";
  dockerImage: string;
  defaultPort: number;
  internalPort: number;
  defaultStartup?: string | null;
  environment: string;
  description?: string | null;
  icon?: string | null;
  nodeId?: string | null;
  node?: { id: string; name: string; status: string } | null;
  isOfficial: boolean;
  isPulled: boolean;
  lastPulledAt?: string | null;
  createdAt: string;
  _count?: { servers: number };
}

interface NodeItem {
  id: string;
  name: string;
  fqdn: string;
  status: string;
  isOnline?: boolean;
  lastHeartbeat?: string | null;
}

interface DockerHubPreset {
  id: string;
  name: string;
  category: "RUNTIME" | "DATABASE" | "WEB" | "GAME" | "TOOL" | "CUSTOM";
  dockerImage: string;
  tag: string;
  defaultPort: number;
  internalPort: number;
  defaultStartup: string;
  environment: Record<string, string>;
  description: string;
  stars: string;
  pulls: string;
  arch: string[];
  official: boolean;
  hubUrl: string;
  recommendedRam: string;
  iconType: "python" | "rust" | "node" | "go" | "java" | "php" | "ruby" | "c" | "dotnet" | "bun" | "deno" | "mysql" | "postgres" | "redis" | "mongo" | "maria" | "rabbit" | "elastic" | "meili" | "nginx" | "caddy" | "apache" | "traefik" | "mc" | "steam" | "game" | "ai" | "linux" | "box";
}

const EXTENSIVE_DOCKER_HUB_CATALOG: DockerHubPreset[] = [
  // ─────────────────────────────────────────────────────────────────────────────
  // 1. LANGUAGES & RUNTIMES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "python-312-slim",
    name: "Python 3.12 (Slim)",
    category: "RUNTIME",
    dockerImage: "python:3.12-slim",
    tag: "3.12-slim",
    defaultPort: 8000,
    internalPort: 8000,
    defaultStartup: "python -u main.py",
    environment: { PORT: "8000", PYTHONUNBUFFERED: "1" },
    description: "Official Python 3.12 slim runtime for FastAPI, Flask, Django, machine learning workers, and bots.",
    stars: "11.4k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/python",
    recommendedRam: "512 MB+",
    iconType: "python",
  },
  {
    id: "python-311-alpine",
    name: "Python 3.11 (Alpine)",
    category: "RUNTIME",
    dockerImage: "python:3.11-alpine",
    tag: "3.11-alpine",
    defaultPort: 8000,
    internalPort: 8000,
    defaultStartup: "python -u main.py",
    environment: { PORT: "8000", PYTHONUNBUFFERED: "1" },
    description: "Ultra-compact Python 3.11 environment built on Alpine Linux for lightweight background microservices.",
    stars: "11.4k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/python",
    recommendedRam: "256 MB+",
    iconType: "python",
  },
  {
    id: "rust-180-alpine",
    name: "Rust 1.80 (Cargo Alpine)",
    category: "RUNTIME",
    dockerImage: "rust:1.80-alpine",
    tag: "1.80-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "cargo run --release",
    environment: { PORT: "8080", RUST_LOG: "info" },
    description: "High-performance Rust 1.80 toolchain with Cargo build runner on lightweight Alpine musl.",
    stars: "3.9k",
    pulls: "100M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/rust",
    recommendedRam: "1024 MB+",
    iconType: "rust",
  },
  {
    id: "rust-nightly",
    name: "Rust Nightly Toolchain",
    category: "RUNTIME",
    dockerImage: "rustlang/rust:nightly-alpine",
    tag: "nightly-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "cargo run --release",
    environment: { PORT: "8080", RUST_LOG: "debug" },
    description: "Bleeding-edge Rust nightly compiler and experimental features for modern async engines.",
    stars: "2.1k",
    pulls: "50M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/rustlang/rust",
    recommendedRam: "1024 MB+",
    iconType: "rust",
  },
  {
    id: "node-22-alpine",
    name: "Node.js 22 (Current LTS)",
    category: "RUNTIME",
    dockerImage: "node:22-alpine",
    tag: "22-alpine",
    defaultPort: 3000,
    internalPort: 3000,
    defaultStartup: "node server.js",
    environment: { PORT: "3000", NODE_ENV: "production" },
    description: "Latest Node.js 22 LTS environment for Next.js, Express, Fastify, and full-stack TypeScript apps.",
    stars: "14.8k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/node",
    recommendedRam: "512 MB+",
    iconType: "node",
  },
  {
    id: "node-20-alpine",
    name: "Node.js 20 (Active LTS)",
    category: "RUNTIME",
    dockerImage: "node:20-alpine",
    tag: "20-alpine",
    defaultPort: 3000,
    internalPort: 3000,
    defaultStartup: "node server.js",
    environment: { PORT: "3000", NODE_ENV: "production" },
    description: "Battle-tested Node.js 20 Active LTS release with npm & yarn bundled.",
    stars: "14.8k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/node",
    recommendedRam: "512 MB+",
    iconType: "node",
  },
  {
    id: "bun-runtime",
    name: "Bun 1.1 Fast Runtime",
    category: "RUNTIME",
    dockerImage: "oven/bun:alpine",
    tag: "alpine",
    defaultPort: 3000,
    internalPort: 3000,
    defaultStartup: "bun run index.ts",
    environment: { PORT: "3000", NODE_ENV: "production" },
    description: "Incredibly fast all-in-one JavaScript & TypeScript runtime, bundler, and package manager.",
    stars: "5.1k",
    pulls: "50M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/oven/bun",
    recommendedRam: "256 MB+",
    iconType: "bun",
  },
  {
    id: "deno-runtime",
    name: "Deno 2.0 Secure Runtime",
    category: "RUNTIME",
    dockerImage: "denoland/deno:alpine",
    tag: "alpine",
    defaultPort: 8000,
    internalPort: 8000,
    defaultStartup: "deno run --allow-net --allow-read main.ts",
    environment: { PORT: "8000" },
    description: "Next-generation secure JavaScript and TypeScript runtime by Ryan Dahl.",
    stars: "3.7k",
    pulls: "50M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/denoland/deno",
    recommendedRam: "256 MB+",
    iconType: "deno",
  },
  {
    id: "golang-123-alpine",
    name: "Golang 1.23",
    category: "RUNTIME",
    dockerImage: "golang:1.23-alpine",
    tag: "1.23-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "go run main.go",
    environment: { PORT: "8080", GIN_MODE: "release" },
    description: "Official Google Go compiler and standard library for highly concurrent cloud services.",
    stars: "13.2k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/golang",
    recommendedRam: "512 MB+",
    iconType: "go",
  },
  {
    id: "adoptium-java-21",
    name: "Adoptium Java 21 LTS",
    category: "RUNTIME",
    dockerImage: "eclipse-temurin:21-alpine",
    tag: "21-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "java -jar app.jar",
    environment: { PORT: "8080" },
    description: "Adoptium OpenJDK 21 LTS enterprise production JVM on Alpine Linux.",
    stars: "1.6k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/eclipse-temurin",
    recommendedRam: "1024 MB+",
    iconType: "java",
  },
  {
    id: "adoptium-java-17",
    name: "Adoptium Java 17 LTS",
    category: "RUNTIME",
    dockerImage: "eclipse-temurin:17-alpine",
    tag: "17-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "java -jar app.jar",
    environment: { PORT: "8080" },
    description: "Adoptium OpenJDK 17 LTS enterprise JVM for standard Spring Boot and enterprise apps.",
    stars: "1.6k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/eclipse-temurin",
    recommendedRam: "1024 MB+",
    iconType: "java",
  },
  {
    id: "php-83-cli",
    name: "PHP 8.3 CLI & Dev",
    category: "RUNTIME",
    dockerImage: "php:8.3-cli-alpine",
    tag: "8.3-cli-alpine",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "php -S 0.0.0.0:8080 -t public",
    environment: { PORT: "8080" },
    description: "Modern PHP 8.3 CLI environment with built-in development HTTP server.",
    stars: "7.3k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/php",
    recommendedRam: "256 MB+",
    iconType: "php",
  },
  {
    id: "ruby-33-alpine",
    name: "Ruby 3.3 (YJIT Enabled)",
    category: "RUNTIME",
    dockerImage: "ruby:3.3-alpine",
    tag: "3.3-alpine",
    defaultPort: 3000,
    internalPort: 3000,
    defaultStartup: "bundle exec rails server -b 0.0.0.0 -p 3000",
    environment: { PORT: "3000", RAILS_ENV: "production" },
    description: "Official Ruby 3.3 interpreter with YJIT enabled for high-concurrency Sinatra and Rails.",
    stars: "4.1k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/ruby",
    recommendedRam: "512 MB+",
    iconType: "ruby",
  },
  {
    id: "gcc-14-compiler",
    name: "GCC 14 / C++ Toolchain",
    category: "RUNTIME",
    dockerImage: "gcc:14",
    tag: "14",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "g++ main.cpp -o app && ./app",
    environment: { PORT: "8080" },
    description: "GNU C and C++ compiler toolchain with standard headers and build utilities.",
    stars: "2.8k",
    pulls: "200M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/gcc",
    recommendedRam: "512 MB+",
    iconType: "c",
  },
  {
    id: "dotnet-8-sdk",
    name: ".NET 8.0 SDK",
    category: "RUNTIME",
    dockerImage: "mcr.microsoft.com/dotnet/sdk:8.0-alpine",
    tag: "8.0-alpine",
    defaultPort: 5000,
    internalPort: 5000,
    defaultStartup: "dotnet run",
    environment: { ASPNETCORE_URLS: "http://+:5000" },
    description: "Microsoft .NET 8.0 SDK for building and executing C# and F# ASP.NET Core applications.",
    stars: "3.5k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/microsoft-dotnet",
    recommendedRam: "1024 MB+",
    iconType: "dotnet",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. DATABASES & STORAGE
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "mysql-84-lts",
    name: "MySQL 8.4 LTS Database",
    category: "DATABASE",
    dockerImage: "mysql:8.4",
    tag: "8.4",
    defaultPort: 3306,
    internalPort: 3306,
    defaultStartup: "docker-entrypoint.sh mysqld",
    environment: { MYSQL_ROOT_PASSWORD: "ChangeMeRoot123!", MYSQL_DATABASE: "rubber_app" },
    description: "Latest MySQL 8.4 Long Term Support relational database system.",
    stars: "15.9k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/mysql",
    recommendedRam: "1024 MB+",
    iconType: "mysql",
  },
  {
    id: "mysql-80-community",
    name: "MySQL 8.0 Community",
    category: "DATABASE",
    dockerImage: "mysql:8.0",
    tag: "8.0",
    defaultPort: 3306,
    internalPort: 3306,
    defaultStartup: "docker-entrypoint.sh mysqld",
    environment: { MYSQL_ROOT_PASSWORD: "ChangeMeRoot123!", MYSQL_DATABASE: "rubber_app" },
    description: "Standard production MySQL 8.0 engine with persistence volume mounts.",
    stars: "15.9k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/mysql",
    recommendedRam: "1024 MB+",
    iconType: "mysql",
  },
  {
    id: "postgres-16-alpine",
    name: "PostgreSQL 16",
    category: "DATABASE",
    dockerImage: "postgres:16-alpine",
    tag: "16-alpine",
    defaultPort: 5432,
    internalPort: 5432,
    defaultStartup: "docker-entrypoint.sh postgres",
    environment: { POSTGRES_PASSWORD: "ChangeMeRoot123!", POSTGRES_DB: "rubber_app", POSTGRES_USER: "postgres" },
    description: "Enterprise-grade PostgreSQL 16 SQL database engine with ACID compliance on Alpine.",
    stars: "15.1k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/postgres",
    recommendedRam: "512 MB+",
    iconType: "postgres",
  },
  {
    id: "postgres-15-alpine",
    name: "PostgreSQL 15",
    category: "DATABASE",
    dockerImage: "postgres:15-alpine",
    tag: "15-alpine",
    defaultPort: 5432,
    internalPort: 5432,
    defaultStartup: "docker-entrypoint.sh postgres",
    environment: { POSTGRES_PASSWORD: "ChangeMeRoot123!", POSTGRES_DB: "rubber_app", POSTGRES_USER: "postgres" },
    description: "Widely supported PostgreSQL 15 relational database for production applications.",
    stars: "15.1k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/postgres",
    recommendedRam: "512 MB+",
    iconType: "postgres",
  },
  {
    id: "redis-7-alpine",
    name: "Redis 7 In-Memory Store",
    category: "DATABASE",
    dockerImage: "redis:7-alpine",
    tag: "7-alpine",
    defaultPort: 6379,
    internalPort: 6379,
    defaultStartup: "redis-server --protected-mode no",
    environment: { ALLOW_EMPTY_PASSWORD: "yes" },
    description: "Ultra-fast Redis in-memory cache, key-value data structure, and pub/sub message broker.",
    stars: "13.6k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/redis",
    recommendedRam: "256 MB+",
    iconType: "redis",
  },
  {
    id: "mongo-70-community",
    name: "MongoDB 7.0 Community",
    category: "DATABASE",
    dockerImage: "mongo:7.0",
    tag: "7.0",
    defaultPort: 27017,
    internalPort: 27017,
    defaultStartup: "docker-entrypoint.sh mongod --bind_ip_all",
    environment: { MONGO_INITDB_ROOT_USERNAME: "admin", MONGO_INITDB_ROOT_PASSWORD: "ChangeMeRoot123!" },
    description: "General-purpose document-based distributed NoSQL database with JSON schema validation.",
    stars: "11.2k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/mongo",
    recommendedRam: "1024 MB+",
    iconType: "mongo",
  },
  {
    id: "mariadb-11",
    name: "MariaDB 11",
    category: "DATABASE",
    dockerImage: "mariadb:11",
    tag: "11",
    defaultPort: 3306,
    internalPort: 3306,
    defaultStartup: "docker-entrypoint.sh mariadbd",
    environment: { MARIADB_ROOT_PASSWORD: "ChangeMeRoot123!", MARIADB_DATABASE: "rubber_app" },
    description: "High-performance open-source MySQL fork developed by the original MySQL creators.",
    stars: "5.6k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/mariadb",
    recommendedRam: "1024 MB+",
    iconType: "maria",
  },
  {
    id: "rabbitmq-3-management",
    name: "RabbitMQ 3 Management",
    category: "DATABASE",
    dockerImage: "rabbitmq:3-management-alpine",
    tag: "3-management-alpine",
    defaultPort: 5672,
    internalPort: 5672,
    defaultStartup: "docker-entrypoint.sh rabbitmq-server",
    environment: { RABBITMQ_DEFAULT_USER: "admin", RABBITMQ_DEFAULT_PASS: "ChangeMeRoot123!" },
    description: "Robust AMQP message broker with integrated web management UI on port 15672.",
    stars: "5.2k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/rabbitmq",
    recommendedRam: "512 MB+",
    iconType: "rabbit",
  },
  {
    id: "elasticsearch-8",
    name: "Elasticsearch 8",
    category: "DATABASE",
    dockerImage: "elasticsearch:8.15.0",
    tag: "8.15.0",
    defaultPort: 9200,
    internalPort: 9200,
    defaultStartup: "bin/elasticsearch",
    environment: { "discovery.type": "single-node", "xpack.security.enabled": "false" },
    description: "Distributed, RESTful search and analytics engine for structured and un-structured big data.",
    stars: "6.4k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/elasticsearch",
    recommendedRam: "2048 MB+",
    iconType: "elastic",
  },
  {
    id: "meilisearch",
    name: "Meilisearch Fast Search",
    category: "DATABASE",
    dockerImage: "getmeili/meilisearch:latest",
    tag: "latest",
    defaultPort: 7700,
    internalPort: 7700,
    defaultStartup: "meilisearch",
    environment: { MEILI_MASTER_KEY: "MasterKeyForMeiliSearch123!" },
    description: "Lightning-fast, typo-tolerant, open-source search engine with simple REST API.",
    stars: "2.3k",
    pulls: "20M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/getmeili/meilisearch",
    recommendedRam: "512 MB+",
    iconType: "meili",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. WEB SERVERS & REVERSE PROXIES
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "nginx-126-alpine",
    name: "Nginx 1.26 Web Server",
    category: "WEB",
    dockerImage: "nginx:1.26-alpine",
    tag: "1.26-alpine",
    defaultPort: 80,
    internalPort: 80,
    defaultStartup: "nginx -g 'daemon off;'",
    environment: { PORT: "80" },
    description: "High-performance HTTP web server, reverse proxy, and static file distributor.",
    stars: "20.3k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/nginx",
    recommendedRam: "128 MB+",
    iconType: "nginx",
  },
  {
    id: "caddy-2-alpine",
    name: "Caddy 2 Automatic HTTPS",
    category: "WEB",
    dockerImage: "caddy:2-alpine",
    tag: "2-alpine",
    defaultPort: 80,
    internalPort: 80,
    defaultStartup: "caddy run --config /etc/caddy/Caddyfile --adapter caddyfile",
    environment: { PORT: "80" },
    description: "Modern enterprise web server written in Go with automatic HTTPS, HTTP/3, and clean Caddyfiles.",
    stars: "3.4k",
    pulls: "100M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/caddy",
    recommendedRam: "128 MB+",
    iconType: "caddy",
  },
  {
    id: "apache-httpd",
    name: "Apache HTTP Server (httpd)",
    category: "WEB",
    dockerImage: "httpd:2.4-alpine",
    tag: "2.4-alpine",
    defaultPort: 80,
    internalPort: 80,
    defaultStartup: "httpd-foreground",
    environment: { PORT: "80" },
    description: "The classic Apache 2.4 HTTP Server on Alpine Linux for hosting web apps and static files.",
    stars: "4.8k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/httpd",
    recommendedRam: "128 MB+",
    iconType: "apache",
  },
  {
    id: "traefik-v3",
    name: "Traefik v3 Edge Proxy",
    category: "WEB",
    dockerImage: "traefik:v3.1",
    tag: "v3.1",
    defaultPort: 80,
    internalPort: 80,
    defaultStartup: "traefik",
    environment: { TRAEFIK_API_INSECURE: "true" },
    description: "Leading cloud-native application proxy and reverse router with automatic dashboard.",
    stars: "6.9k",
    pulls: "500M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/traefik",
    recommendedRam: "256 MB+",
    iconType: "traefik",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. GAME SERVERS & STEAMCMD
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "palworld-server",
    name: "Palworld Dedicated Server",
    category: "GAME",
    dockerImage: "thijsvanloef/palworld-server-docker:latest",
    tag: "latest",
    defaultPort: 8211,
    internalPort: 8211,
    defaultStartup: "/home/steam/server/init.sh",
    environment: {
      PLAYERS: "16",
      MULTITHREAD_ENABLED: "true",
      SERVER_NAME: "Rubber Palworld Server",
      SERVER_DESCRIPTION: "Powered by Rubber Panel",
      ADMIN_PASSWORD: "AdminPassword123!",
      SERVER_PASSWORD: "",
      RCON_ENABLED: "true",
      RCON_PORT: "25575",
      COMMUNITY: "false",
      UPDATE_ON_BOOT: "true",
    },
    description: "High-performance Palworld multiplayer dedicated server with automated SteamCMD updates, RCON management, and multithreading.",
    stars: "2.1k",
    pulls: "15M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/thijsvanloef/palworld-server-docker",
    recommendedRam: "8192 MB+",
    iconType: "game",
  },
  {
    id: "rust-dedicated",
    name: "Rust Dedicated Server (uMod/Oxide)",
    category: "GAME",
    dockerImage: "didstopia/rust-server:latest",
    tag: "latest",
    defaultPort: 28015,
    internalPort: 28015,
    defaultStartup: "/entrypoint.sh",
    environment: {
      RUST_SERVER_NAME: "Rubber Rust Server",
      RUST_SERVER_WORLDSIZE: "3000",
      RUST_SERVER_SEED: "12345",
      RUST_SERVER_MAXPLAYERS: "50",
      RUST_RCON_PORT: "28016",
      RUST_RCON_PASSWORD: "ChangeMeRcon123!",
      RUST_OXIDE: "1",
      RUST_UPDATE_CHECKING: "1",
    },
    description: "Production Rust dedicated server with Oxide/uMod plugin framework, automated wipe utilities, and RCON web panel support.",
    stars: "2.4k",
    pulls: "25M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/didstopia/rust-server",
    recommendedRam: "8192 MB+",
    iconType: "steam",
  },
  {
    id: "valheim-server",
    name: "Valheim Dedicated Server",
    category: "GAME",
    dockerImage: "lloesche/valheim-server:latest",
    tag: "latest",
    defaultPort: 2456,
    internalPort: 2456,
    defaultStartup: "/usr/local/bin/valheim-server",
    environment: {
      SERVER_NAME: "Rubber Valheim",
      WORLD_NAME: "RubberWorld",
      SERVER_PASS: "SecretPass123",
      SERVER_PUBLIC: "1",
      UPDATE_IF_NEW: "true",
      BACKUPS: "true",
      BACKUPS_INTERVAL: "3600",
    },
    description: "Enterprise-ready Valheim dedicated server with world backup automation, crossplay support, and Discord webhook notifications.",
    stars: "1.6k",
    pulls: "12M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/lloesche/valheim-server",
    recommendedRam: "4096 MB+",
    iconType: "game",
  },
  {
    id: "cs2-dedicated",
    name: "Counter-Strike 2 (CS2) Dedicated",
    category: "GAME",
    dockerImage: "cm2network/cs2:latest",
    tag: "latest",
    defaultPort: 27015,
    internalPort: 27015,
    defaultStartup: "/home/steam/cs2-dedicated/game/bin/linuxsteamrt64/cs2 -dedicated +ip 0.0.0.0 -port 27015 +map de_dust2",
    environment: {
      SRCDS_TOKEN: "",
      CS2_SERVERNAME: "Rubber CS2 Dedicated Server",
      CS2_PW: "",
      CS2_RCON_PW: "ChangeMeRcon123!",
      CS2_GAME_MODE: "0",
      CS2_GAME_TYPE: "0",
      CS2_MAP: "de_dust2",
      CS2_MAPGROUP: "mg_active",
      CS2_MAXPLAYERS: "16",
    },
    description: "Official Counter-Strike 2 (Source 2) dedicated server with SteamCMD auto-updater, GSLT token integration, and workshop support.",
    stars: "2.8k",
    pulls: "30M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/cm2network/cs2",
    recommendedRam: "4096 MB+",
    iconType: "steam",
  },
  {
    id: "terraria-tshock",
    name: "Terraria TShock Server",
    category: "GAME",
    dockerImage: "tshock/tshock:latest",
    tag: "latest",
    defaultPort: 7777,
    internalPort: 7777,
    defaultStartup: "mono /tshock/TerrariaServer.exe -port 7777 -world /data/world.wld -autocreate 2 -maxplayers 16",
    environment: {
      WORLD_NAME: "RubberTerraria",
      WORLD_SIZE: "2",
      DIFFICULTY: "1",
      MOTD: "Welcome to Rubber Terraria!",
    },
    description: "TShock for Terraria: High-performance multiplayer server with user permissions, anti-griefing protection, and REST API.",
    stars: "850+",
    pulls: "8M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/tshock/tshock",
    recommendedRam: "2048 MB+",
    iconType: "game",
  },
  {
    id: "project-zomboid",
    name: "Project Zomboid Dedicated",
    category: "GAME",
    dockerImage: "whikloj/docker-project-zomboid:latest",
    tag: "latest",
    defaultPort: 16261,
    internalPort: 16261,
    defaultStartup: "/home/steam/server/start-server.sh",
    environment: {
      SERVER_NAME: "RubberZomboid",
      ADMIN_PASSWORD: "AdminPassword123!",
      DEFAULT_PORT: "16261",
      UDP_PORT: "16262",
      MAX_PLAYERS: "16",
    },
    description: "Project Zomboid dedicated multiplayer server container with automated Steam workshop mods loader and world saves manager.",
    stars: "600+",
    pulls: "5M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/whikloj/docker-project-zomboid",
    recommendedRam: "4096 MB+",
    iconType: "steam",
  },
  {
    id: "ark-survival",
    name: "ARK: Survival Ascended / Evolved",
    category: "GAME",
    dockerImage: "hermsi/ark-server:latest",
    tag: "latest",
    defaultPort: 7777,
    internalPort: 7777,
    defaultStartup: "/home/steam/server/ShooterGame/Binaries/Linux/ShooterGameServer TheIsland?listen?SessionName=RubberARK -server -log",
    environment: {
      SESSION_NAME: "Rubber ARK Server",
      SERVER_PASSWORD: "",
      ADMIN_PASSWORD: "AdminPassword123!",
      MAX_PLAYERS: "30",
      MAP: "TheIsland",
    },
    description: "High-performance ARK Survival dedicated server with Crossplay, BattleEye anti-cheat, and mod download automation.",
    stars: "1.1k",
    pulls: "10M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/hermsi/ark-server",
    recommendedRam: "8192 MB+",
    iconType: "steam",
  },
  {
    id: "7days-to-die",
    name: "7 Days to Die Dedicated",
    category: "GAME",
    dockerImage: "vinanr/7daystodie:latest",
    tag: "latest",
    defaultPort: 26900,
    internalPort: 26900,
    defaultStartup: "/entrypoint.sh",
    environment: {
      SERVER_NAME: "Rubber 7 Days to Die",
      SERVER_PASSWORD: "",
      ADMIN_PASSWORD: "AdminPassword123!",
      GAME_NAME: "RubberWorld",
      GAME_MODE: "GameModeSurvival",
    },
    description: "7 Days to Die dedicated zombie apocalypse server with automated world generation, Telnet console, and SteamCMD updates.",
    stars: "500+",
    pulls: "4M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/vinanr/7daystodie",
    recommendedRam: "6144 MB+",
    iconType: "game",
  },
  {
    id: "tf2-dedicated",
    name: "Team Fortress 2 (TF2) Dedicated",
    category: "GAME",
    dockerImage: "cm2network/tf2:latest",
    tag: "latest",
    defaultPort: 27015,
    internalPort: 27015,
    defaultStartup: "/home/steam/tf2-dedicated/srcds_run -game tf +map ctf_2fort +maxplayers 24",
    environment: {
      SRCDS_TOKEN: "",
      TF2_SERVERNAME: "Rubber TF2 Server",
      TF2_MAP: "ctf_2fort",
      TF2_MAXPLAYERS: "24",
    },
    description: "Source Engine Team Fortress 2 dedicated server with SourceMod/MetaMod plugins and custom maps support.",
    stars: "1.2k",
    pulls: "12M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/cm2network/tf2",
    recommendedRam: "2048 MB+",
    iconType: "steam",
  },
  {
    id: "enshrouded-dedicated",
    name: "Enshrouded Dedicated Server",
    category: "GAME",
    dockerImage: "skarlso/enshrouded-server:latest",
    tag: "latest",
    defaultPort: 15636,
    internalPort: 15636,
    defaultStartup: "/entrypoint.sh",
    environment: {
      SERVER_NAME: "Rubber Enshrouded",
      SERVER_PASSWORD: "Pass123!",
      GAME_PORT: "15636",
      QUERY_PORT: "15637",
      SLOT_COUNT: "16",
    },
    description: "Enshrouded voxel-based survival action RPG multiplayer dedicated server with SteamCMD auto-updater.",
    stars: "400+",
    pulls: "3M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/skarlso/enshrouded-server",
    recommendedRam: "8192 MB+",
    iconType: "game",
  },
  {
    id: "steamcmd-universal",
    name: "SteamCMD Universal Server Host",
    category: "GAME",
    dockerImage: "cm2network/steamcmd:latest",
    tag: "latest",
    defaultPort: 27015,
    internalPort: 27015,
    defaultStartup: "steamcmd +login anonymous +quit",
    environment: { STEAMAPPID: "", STEAMAPPNAME: "" },
    description: "Universal SteamCMD base image for installing and running ANY Steam dedicated server via App ID.",
    stars: "1.9k",
    pulls: "50M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/cm2network/steamcmd",
    recommendedRam: "2048 MB+",
    iconType: "steam",
  },
  {
    id: "itzg-minecraft-server",
    name: "Minecraft Java (Paper/Purpur/Forge)",
    category: "GAME",
    dockerImage: "itzg/minecraft-server:latest",
    tag: "latest",
    defaultPort: 25565,
    internalPort: 25565,
    defaultStartup: "/start",
    environment: { EULA: "TRUE", TYPE: "PAPER", VERSION: "LATEST", MEMORY: "2G" },
    description: "Most widely used Minecraft Java Edition container supporting Paper, Purpur, Forge, Fabric, and Spigot.",
    stars: "4.2k",
    pulls: "100M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/itzg/minecraft-server",
    recommendedRam: "2048 MB+",
    iconType: "mc",
  },
  {
    id: "itzg-bedrock-server",
    name: "Minecraft Bedrock Dedicated",
    category: "GAME",
    dockerImage: "itzg/minecraft-bedrock-server:latest",
    tag: "latest",
    defaultPort: 19132,
    internalPort: 19132,
    defaultStartup: "/usr/local/bin/bedrock-server",
    environment: { EULA: "TRUE", GAMEMODE: "survival", DIFFICULTY: "easy" },
    description: "Official Minecraft Bedrock Edition dedicated server container for mobile, Windows, and console players.",
    stars: "1.1k",
    pulls: "20M+",
    arch: ["amd64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/itzg/minecraft-bedrock-server",
    recommendedRam: "1024 MB+",
    iconType: "mc",
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. AI, ML & SYSTEM TOOLS
  // ─────────────────────────────────────────────────────────────────────────────
  {
    id: "ollama-ai",
    name: "Ollama Local AI LLM",
    category: "TOOL",
    dockerImage: "ollama/ollama:latest",
    tag: "latest",
    defaultPort: 11434,
    internalPort: 11434,
    defaultStartup: "ollama serve",
    environment: { OLLAMA_HOST: "0.0.0.0" },
    description: "Run Llama 3.1, Mistral, Gemma 2, DeepSeek, and open-source models locally with REST API.",
    stars: "5.4k",
    pulls: "50M+",
    arch: ["amd64", "arm64"],
    official: false,
    hubUrl: "https://hub.docker.com/r/ollama/ollama",
    recommendedRam: "4096 MB+",
    iconType: "ai",
  },
  {
    id: "pytorch-latest",
    name: "PyTorch ML & Deep Learning",
    category: "TOOL",
    dockerImage: "pytorch/pytorch:latest",
    tag: "latest",
    defaultPort: 8888,
    internalPort: 8888,
    defaultStartup: "python -u main.py",
    environment: { PYTHONUNBUFFERED: "1" },
    description: "Official PyTorch container with Torch, TorchVision, and scientific computing packages.",
    stars: "4.3k",
    pulls: "100M+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/r/pytorch/pytorch",
    recommendedRam: "4096 MB+",
    iconType: "ai",
  },
  {
    id: "alpine-linux",
    name: "Alpine Linux Base",
    category: "TOOL",
    dockerImage: "alpine:latest",
    tag: "latest",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "sh",
    environment: {},
    description: "Lightweight 5MB Linux distribution based on musl libc and busybox for minimal tasks.",
    stars: "11.8k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/alpine",
    recommendedRam: "64 MB+",
    iconType: "linux",
  },
  {
    id: "ubuntu-2404",
    name: "Ubuntu 24.04 LTS (Noble)",
    category: "TOOL",
    dockerImage: "ubuntu:24.04",
    tag: "24.04",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "bash",
    environment: {},
    description: "Official Ubuntu 24.04 LTS Noble Numbat container environment for general purpose compute.",
    stars: "17.6k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/ubuntu",
    recommendedRam: "256 MB+",
    iconType: "linux",
  },
  {
    id: "debian-12",
    name: "Debian 12 (Bookworm)",
    category: "TOOL",
    dockerImage: "debian:bookworm-slim",
    tag: "bookworm-slim",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "bash",
    environment: {},
    description: "Debian 12 Bookworm stable base image for robust Linux services.",
    stars: "5.1k",
    pulls: "1B+",
    arch: ["amd64", "arm64"],
    official: true,
    hubUrl: "https://hub.docker.com/_/debian",
    recommendedRam: "256 MB+",
    iconType: "linux",
  },
];

export default function ImagesPage() {
  const router = useRouter();

  // State
  const [activeTab, setActiveTab] = useState<"dockerhub" | "installed" | "custom">("dockerhub");
  const [installedImages, setInstalledImages] = useState<ContainerImageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [nodes, setNodes] = useState<NodeItem[]>([]);
  const [selectedNodeFilter, setSelectedNodeFilter] = useState("ALL");
  const [categoryFilter, setCategoryFilter] = useState<"ALL" | "RUNTIME" | "DATABASE" | "WEB" | "GAME" | "TOOL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Quick Action Loading States (keyed by image identifier)
  const [actionLoadingMap, setActionLoadingMap] = useState<Record<string, boolean>>({});

  // Pull / Install Modal State
  const [showPullModal, setShowPullModal] = useState(false);
  const [pullSubmitting, setPullSubmitting] = useState(false);
  const [pullStatusMessage, setPullStatusMessage] = useState<{ success: boolean; message: string } | null>(null);

  const [pullForm, setPullForm] = useState({
    name: "",
    dockerImage: "",
    category: "RUNTIME" as "RUNTIME" | "DATABASE" | "WEB" | "CUSTOM" | "GAME" | "TOOL",
    defaultPort: 8080,
    internalPort: 8080,
    defaultStartup: "",
    environment: "{}",
    description: "",
    nodeId: "",
    pullNow: true,
  });

  async function loadData() {
    try {
      setLoading(true);
      const [imagesRes, nodesRes] = await Promise.all([
        fetch("/api/admin/images"),
        fetch("/api/admin/nodes"),
      ]);

      if (imagesRes.ok) {
        const d = await imagesRes.json();
        setInstalledImages(d.images || []);
      }

      if (nodesRes.ok) {
        const nd = await nodesRes.json();
        const rawNodes: NodeItem[] = nd.nodes || [];
        setNodes(rawNodes);
        // Default target node to first online node if possible
        const onlineNode = rawNodes.find(n => n.isOnline || n.status === "ONLINE");
        if (onlineNode && !pullForm.nodeId) {
          setPullForm(f => ({ ...f, nodeId: onlineNode.id }));
        } else if (rawNodes[0] && !pullForm.nodeId) {
          setPullForm(f => ({ ...f, nodeId: rawNodes[0].id }));
        }
      }
    } catch (e) {
      console.error("Failed to load images:", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  // Online Nodes count (1-minute heartbeat threshold verified by backend)
  const onlineNodesCount = useMemo(() => {
    return nodes.filter(n => n.isOnline || n.status === "ONLINE").length;
  }, [nodes]);

  // Set loading helper
  function setItemLoading(key: string, val: boolean) {
    setActionLoadingMap(prev => ({ ...prev, [key]: val }));
  }

  // Quick "Get" (Install) preset image directly
  async function handleQuickGet(preset: DockerHubPreset, targetNodeId?: string) {
    const key = preset.dockerImage;
    setItemLoading(key, true);
    try {
      const chosenNodeId = targetNodeId || (nodes.find(n => n.isOnline || n.status === "ONLINE")?.id || nodes[0]?.id || "");
      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: preset.name,
          dockerImage: preset.dockerImage,
          category: preset.category,
          defaultPort: preset.defaultPort,
          internalPort: preset.internalPort,
          defaultStartup: preset.defaultStartup,
          environment: JSON.stringify(preset.environment),
          description: preset.description,
          nodeId: chosenNodeId,
          pullNow: true,
        }),
      });
      if (res.ok) {
        await loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to install image on node.");
      }
    } catch (err: any) {
      alert(err?.message || "Install request failed.");
    } finally {
      setItemLoading(key, false);
    }
  }

  // Quick "Remove" image
  async function handleQuickRemove(dockerImage: string, imageId?: string) {
    if (!confirm(`Are you sure you want to remove image "${dockerImage}" from the available server creation pool?`)) return;
    const key = dockerImage;
    setItemLoading(key, true);
    try {
      const url = imageId ? `/api/admin/images?id=${imageId}` : `/api/admin/images?dockerImage=${encodeURIComponent(dockerImage)}`;
      const res = await fetch(url, { method: "DELETE" });
      if (res.ok) {
        await loadData();
      } else {
        const d = await res.json();
        alert(d.error || "Failed to remove image.");
      }
    } catch (err: any) {
      alert(err?.message || "Remove request failed.");
    } finally {
      setItemLoading(key, false);
    }
  }

  // Open configured Pull Modal for customizing settings
  function openCustomizedPull(preset: DockerHubPreset) {
    setPullStatusMessage(null);
    const chosenNodeId = nodes.find(n => n.isOnline || n.status === "ONLINE")?.id || nodes[0]?.id || "";
    setPullForm({
      name: preset.name,
      dockerImage: preset.dockerImage,
      category: preset.category,
      defaultPort: preset.defaultPort,
      internalPort: preset.internalPort,
      defaultStartup: preset.defaultStartup,
      environment: JSON.stringify(preset.environment, null, 2),
      description: preset.description,
      nodeId: chosenNodeId,
      pullNow: true,
    });
    setShowPullModal(true);
  }

  // Handle custom pull submit
  async function handlePullSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pullForm.dockerImage.trim() || !pullForm.name.trim()) return;

    try {
      setPullSubmitting(true);
      setPullStatusMessage(null);

      const res = await fetch("/api/admin/images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pullForm),
      });

      const data = await res.json();
      if (res.ok) {
        setPullStatusMessage({
          success: true,
          message: `Image "${pullForm.name}" successfully registered & dispatched on node!`,
        });
        await loadData();
        setTimeout(() => {
          setShowPullModal(false);
          setPullStatusMessage(null);
        }, 1200);
      } else {
        setPullStatusMessage({
          success: false,
          message: data.error || "Failed to install image on node.",
        });
      }
    } catch (err: any) {
      setPullStatusMessage({
        success: false,
        message: err?.message || "Pull request failed.",
      });
    } finally {
      setPullSubmitting(false);
    }
  }

  // Helper to test if a preset is installed
  function getInstalledMatch(dockerImage: string): ContainerImageItem | undefined {
    return installedImages.find(img => img.dockerImage.toLowerCase() === dockerImage.toLowerCase());
  }

  // Filtered lists
  const filteredDockerHub = useMemo(() => {
    return EXTENSIVE_DOCKER_HUB_CATALOG.filter(preset => {
      const matchesCategory = categoryFilter === "ALL" || preset.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        preset.name.toLowerCase().includes(q) ||
        preset.dockerImage.toLowerCase().includes(q) ||
        preset.description.toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [categoryFilter, searchQuery]);

  const filteredInstalled = useMemo(() => {
    return installedImages.filter(img => {
      const matchesNode = selectedNodeFilter === "ALL" || img.nodeId === selectedNodeFilter || (!img.nodeId && selectedNodeFilter === "GLOBAL");
      const matchesCategory = categoryFilter === "ALL" || img.category === categoryFilter;
      const q = searchQuery.toLowerCase();
      const matchesSearch = !q ||
        img.name.toLowerCase().includes(q) ||
        img.dockerImage.toLowerCase().includes(q) ||
        (img.description || "").toLowerCase().includes(q);
      return matchesNode && matchesCategory && matchesSearch;
    });
  }, [installedImages, selectedNodeFilter, categoryFilter, searchQuery]);

  // Render Icon by Type
  function renderIcon(type: DockerHubPreset["iconType"] | string, cat?: string) {
    switch (type) {
      case "python":
        return <Code className="w-5 h-5 text-lime-400" />;
      case "rust":
        return <Cpu className="w-5 h-5 text-orange-400" />;
      case "node":
      case "bun":
      case "deno":
        return <ShieldCheck className="w-5 h-5 text-emerald-400" />;
      case "go":
        return <Zap className="w-5 h-5 text-sky-400" />;
      case "java":
        return <Flame className="w-5 h-5 text-amber-400" />;
      case "php":
      case "ruby":
      case "c":
      case "dotnet":
        return <Code className="w-5 h-5 text-purple-400" />;
      case "mysql":
      case "postgres":
      case "maria":
        return <Database className="w-5 h-5 text-blue-400" />;
      case "redis":
      case "mongo":
      case "rabbit":
      case "elastic":
      case "meili":
        return <Database className="w-5 h-5 text-rose-400" />;
      case "nginx":
      case "caddy":
      case "apache":
      case "traefik":
        return <Globe className="w-5 h-5 text-yellow-400" />;
      case "mc":
      case "steam":
      case "game":
        return <Gamepad2 className="w-5 h-5 text-emerald-400" />;
      case "ai":
        return <Sparkles className="w-5 h-5 text-cyan-400" />;
      case "linux":
        return <HardDrive className="w-5 h-5 text-zinc-300" />;
      default:
        if (cat === "DATABASE") return <Database className="w-5 h-5 text-blue-400" />;
        if (cat === "WEB") return <Globe className="w-5 h-5 text-yellow-400" />;
        if (cat === "RUNTIME") return <Code className="w-5 h-5 text-lime-400" />;
        if (cat === "GAME") return <Gamepad2 className="w-5 h-5 text-emerald-400" />;
        return <Box className="w-5 h-5 text-purple-400" />;
    }
  }

  function renderCategoryBadge(cat: string) {
    switch (cat) {
      case "DATABASE":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/25">DATABASE</span>;
      case "WEB":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-yellow-500/15 text-yellow-400 border border-yellow-500/25">WEB SERVER</span>;
      case "TOOL":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-cyan-500/15 text-cyan-400 border border-cyan-500/25">AI &amp; TOOL</span>;
      case "GAME":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">GAME SERVER</span>;
      case "RUNTIME":
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-lime-500/15 text-lime-400 border border-lime-500/25">RUNTIME</span>;
      default:
        return <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/25">CONTAINER</span>;
    }
  }

  return (
    <div className="space-y-6 w-full max-w-full pb-10">
      {/* ─── HERO HEADER ─── */}
      <div
        className="rounded-3xl border p-6 md:p-8 relative overflow-hidden shadow-2xl transition-all"
        style={{
          backgroundColor: "var(--color-rp-surface)",
          borderColor: "var(--color-rp-border)",
        }}
      >
        {/* Subtle background glow */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-lime-400/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2 max-w-2xl">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30 shadow-inner">
                <Box className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-lime-400">
                  Container Image Registry &amp; Multi-Runtimes
                </span>
                <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight" style={{ color: "var(--color-rp-text)" }}>
                  Docker Hub Library
                </h1>
              </div>
            </div>
            <p className="text-xs md:text-sm leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
              Explore 35+ verified official container engines (Python, Rust, Node, MySQL, Postgres, Redis, Minecraft, AI, etc.).
              Click <strong>Get</strong> to download and register any runtime version onto your nodes to create servers.
            </p>
          </div>

          {/* Node Health and Quick Pull Button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Live Online Node Counter */}
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-2xl border bg-black/40 backdrop-blur-md"
              style={{ borderColor: "var(--color-rp-border)" }}
            >
              <div className="relative">
                <Activity className={`w-4 h-4 ${onlineNodesCount > 0 ? "text-lime-400" : "text-zinc-500"}`} />
                {onlineNodesCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-lime-400 animate-ping" />
                )}
              </div>
              <div className="text-left text-xs">
                <p className="font-bold flex items-center gap-1.5" style={{ color: "var(--color-rp-text)" }}>
                  <span>{onlineNodesCount} {onlineNodesCount === 1 ? "Node Online" : "Nodes Online"}</span>
                  <span className="text-[10px] font-normal text-zinc-400">({nodes.length} total)</span>
                </p>
                <p className="text-[10px]" style={{ color: "var(--color-rp-text-muted)" }}>
                  {onlineNodesCount > 0 ? "Heartbeat active (<1m)" : "No nodes currently connected"}
                </p>
              </div>
            </div>

            {/* Custom Image Pull Modal Trigger */}
            <button
              onClick={() => {
                setPullStatusMessage(null);
                setPullForm({
                  name: "",
                  dockerImage: "",
                  category: "RUNTIME",
                  defaultPort: 8080,
                  internalPort: 8080,
                  defaultStartup: "",
                  environment: "{}",
                  description: "",
                  nodeId: nodes.find(n => n.isOnline || n.status === "ONLINE")?.id || nodes[0]?.id || "",
                  pullNow: true,
                });
                setShowPullModal(true);
              }}
              className="flex items-center justify-center gap-2 px-5 py-3 rounded-2xl text-xs font-bold transition-all shadow-lg hover:brightness-110 active:scale-95"
              style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
            >
              <Plus className="w-4 h-4" />
              <span>Pull Custom Image</span>
            </button>
          </div>
        </div>
      </div>

      {/* ─── NAVIGATION CONTROLS & SEARCH ─── */}
      <div className="space-y-4">
        {/* Main Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 p-1.5 rounded-2xl border bg-black/30 w-full sm:w-auto overflow-x-auto" style={{ borderColor: "var(--color-rp-border)" }}>
            <button
              onClick={() => setActiveTab("dockerhub")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none whitespace-nowrap"
              style={activeTab === "dockerhub"
                ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
                : { color: "var(--color-rp-text-muted)" }}
            >
              <Globe className="w-4 h-4" />
              <span>Docker Hub Library ({EXTENSIVE_DOCKER_HUB_CATALOG.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("installed")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none whitespace-nowrap"
              style={activeTab === "installed"
                ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
                : { color: "var(--color-rp-text-muted)" }}
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Installed on Nodes ({installedImages.length})</span>
            </button>

            <button
              onClick={() => setActiveTab("custom")}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex-1 sm:flex-none whitespace-nowrap"
              style={activeTab === "custom"
                ? { backgroundColor: "var(--color-rp-accent)", color: "#000" }
                : { color: "var(--color-rp-text-muted)" }}
            >
              <Download className="w-4 h-4" />
              <span>Custom Registry Pull</span>
            </button>
          </div>

          {/* Search Input */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: "var(--color-rp-text-muted)" }} />
            <input
              type="text"
              placeholder="Search images (python, mysql, rust)..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-2xl text-xs border outline-none transition-all shadow-inner"
              style={{
                backgroundColor: "var(--color-rp-surface)",
                borderColor: "var(--color-rp-border)",
                color: "var(--color-rp-text)",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Category Pills (Mobile Responsive Carousel) */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {[
            { id: "ALL", label: "All Images" },
            { id: "RUNTIME", label: "Languages & Runtimes" },
            { id: "DATABASE", label: "Databases & Storage" },
            { id: "WEB", label: "Web Servers & Proxies" },
            { id: "GAME", label: "Game Servers" },
            { id: "TOOL", label: "AI & System Tools" },
          ].map(cat => {
            const isSelected = categoryFilter === cat.id;
            return (
              <button
                key={cat.id}
                onClick={() => setCategoryFilter(cat.id as any)}
                className="px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border shrink-0"
                style={isSelected
                  ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                  : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── TAB 1: DOCKER HUB REGISTRY EXPLORER ─── */}
      {activeTab === "dockerhub" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredDockerHub.map(preset => {
              const installed = getInstalledMatch(preset.dockerImage);
              const isActionLoading = actionLoadingMap[preset.dockerImage];

              return (
                <div
                  key={preset.id}
                  className="rounded-2xl border p-5 flex flex-col justify-between transition-all group hover:border-lime-500/50 hover:shadow-xl relative bg-gradient-to-b from-white/[0.02] to-transparent"
                  style={{
                    backgroundColor: "var(--color-rp-surface)",
                    borderColor: installed ? "rgba(163, 230, 53, 0.35)" : "var(--color-rp-border)",
                  }}
                >
                  <div className="space-y-3">
                    {/* Card Top Icon & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-black/40 border border-white/10 shrink-0 shadow-inner group-hover:scale-105 transition-transform">
                        {renderIcon(preset.iconType, preset.category)}
                      </div>

                      <div className="flex flex-col items-end gap-1">
                        {renderCategoryBadge(preset.category)}
                        {installed && (
                          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-lime-400/15 text-lime-400 border border-lime-400/30 flex items-center gap-1">
                            <Check className="w-2.5 h-2.5" /> Installed
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Title & Tag */}
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-bold text-sm tracking-tight" title={preset.name} style={{ color: "var(--color-rp-text)" }}>
                          {preset.name}
                        </h3>
                      </div>
                      <p className="text-[11px] font-mono mt-0.5 text-lime-400 truncate" title={preset.dockerImage}>
                        {preset.dockerImage}
                      </p>
                    </div>

                    {/* Description */}
                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                      {preset.description}
                    </p>

                    {/* Metadata Pill Matrix */}
                    <div className="grid grid-cols-2 gap-1.5 text-[10px] pt-1">
                      <div className="p-1.5 rounded-lg border bg-black/20 font-mono truncate" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        Port: <strong className="text-white">:{preset.defaultPort}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg border bg-black/20 truncate" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        RAM: <strong className="text-white">{preset.recommendedRam}</strong>
                      </div>
                    </div>

                    {/* Docker Hub Stats */}
                    <div className="flex items-center justify-between text-[10px] pt-1" style={{ color: "var(--color-rp-text-muted)" }}>
                      <div className="flex items-center gap-1">
                        <Download className="w-3 h-3 text-lime-400" />
                        <span>{preset.pulls}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-yellow-400" />
                        <span>{preset.stars}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[9px] uppercase font-mono text-zinc-400">
                        {preset.arch.join(", ")}
                      </div>
                    </div>
                  </div>

                  {/* Actions Bottom Bar */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <a
                      href={preset.hubUrl}
                      target="_blank"
                      rel="noreferrer"
                      title="View Docker Hub documentation"
                      className="p-2 rounded-xl border hover:bg-white/5 text-zinc-400 hover:text-white transition-all shrink-0"
                      style={{ borderColor: "var(--color-rp-border)" }}
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </a>

                    <div className="flex items-center gap-1.5 flex-1 justify-end">
                      {installed ? (
                        <>
                          {/* Create Server with this Image */}
                          <Link
                            href={`/servers?create=true&imageId=${installed.id}`}
                            className="flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-bold border transition-all flex-1 justify-center shadow-sm"
                            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                          >
                            <Play className="w-3.5 h-3.5" />
                            <span>Launch</span>
                          </Link>

                          {/* Remove button */}
                          <button
                            onClick={() => handleQuickRemove(preset.dockerImage, installed.id)}
                            disabled={isActionLoading}
                            title="Remove image from node catalog"
                            className="p-2 rounded-xl border text-red-400 hover:bg-red-500/15 transition-all"
                            style={{ borderColor: "var(--color-rp-border)" }}
                          >
                            {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </>
                      ) : (
                        <>
                          {/* 1-Click Get Button */}
                          <button
                            onClick={() => handleQuickGet(preset)}
                            disabled={isActionLoading}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all flex-1 justify-center shadow-sm"
                            style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                          >
                            {isActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                            <span>{isActionLoading ? "Getting..." : "Get"}</span>
                          </button>

                          {/* Settings / Customize Pull */}
                          <button
                            onClick={() => openCustomizedPull(preset)}
                            title="Configure node & port before pull"
                            className="p-2 rounded-xl border text-zinc-400 hover:text-white hover:bg-white/5 transition-all"
                            style={{ borderColor: "var(--color-rp-border)" }}
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ─── TAB 2: INSTALLED ON NODES ─── */}
      {activeTab === "installed" && (
        <div className="space-y-4">
          {/* Node Filter Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl border bg-black/30" style={{ borderColor: "var(--color-rp-border)" }}>
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-lime-400" />
              <span className="text-xs font-semibold" style={{ color: "var(--color-rp-text)" }}>Filter by Target Node:</span>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              <button
                onClick={() => setSelectedNodeFilter("ALL")}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0"
                style={selectedNodeFilter === "ALL"
                  ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                  : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                All Nodes
              </button>
              {nodes.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNodeFilter(n.id)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all shrink-0 flex items-center gap-1.5"
                  style={selectedNodeFilter === n.id
                    ? { backgroundColor: "var(--color-rp-accent)", borderColor: "var(--color-rp-accent)", color: "#000" }
                    : { backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
                >
                  <span className={`w-2 h-2 rounded-full ${n.isOnline || n.status === "ONLINE" ? "bg-lime-400" : "bg-zinc-500"}`} />
                  <span>{n.name}</span>
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center" style={{ color: "var(--color-rp-text-muted)" }}>
              <RefreshCw className="w-7 h-7 animate-spin mx-auto mb-3 text-lime-400" />
              <p className="text-xs font-semibold">Loading installed images across fleet...</p>
            </div>
          ) : filteredInstalled.length === 0 ? (
            <div className="py-20 text-center rounded-3xl border p-8" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
              <Box className="w-12 h-12 mx-auto mb-3 opacity-30 text-lime-400" />
              <h3 className="font-bold text-sm" style={{ color: "var(--color-rp-text)" }}>No container images installed on this node</h3>
              <p className="text-xs mt-1 max-w-md mx-auto leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                Click &quot;Get&quot; on any preset from the Docker Hub Library tab or pull a custom image to start provisioning servers.
              </p>
              <button
                onClick={() => setActiveTab("dockerhub")}
                className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold border border-lime-400/30 bg-lime-400/10 text-lime-400 hover:bg-lime-400 hover:text-black transition-all"
              >
                <Globe className="w-4 h-4" />
                <span>Explore Docker Hub Library</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredInstalled.map(img => (
                <div
                  key={img.id}
                  className="rounded-2xl border p-5 flex flex-col justify-between transition-all hover:border-lime-500/50 hover:shadow-xl"
                  style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
                >
                  <div className="space-y-3">
                    {/* Top Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-black/40 border border-white/10 shrink-0">
                        {renderIcon(img.category.toLowerCase(), img.category)}
                      </div>
                      {renderCategoryBadge(img.category)}
                    </div>

                    <div>
                      <h3 className="font-bold text-sm tracking-tight" title={img.name} style={{ color: "var(--color-rp-text)" }}>
                        {img.name}
                      </h3>
                      <p className="text-[11px] font-mono mt-0.5 text-lime-400 truncate" title={img.dockerImage}>
                        {img.dockerImage}
                      </p>
                    </div>

                    <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: "var(--color-rp-text-muted)" }}>
                      {img.description || "Custom container runtime managed by Rubber Panel."}
                    </p>

                    <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                      <div className="p-1.5 rounded-lg border bg-black/20 font-mono" style={{ borderColor: "var(--color-rp-border)" }}>
                        Port: <strong className="text-white">:{img.defaultPort}</strong>
                      </div>
                      <div className="p-1.5 rounded-lg border bg-black/20 truncate" style={{ borderColor: "var(--color-rp-border)" }}>
                        Node: <strong className="text-white">{img.node?.name || "Global"}</strong>
                      </div>
                    </div>

                    {img.defaultStartup && (
                      <div className="p-2 rounded-xl border bg-black/40 font-mono text-[10px] truncate" style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}>
                        <span className="text-lime-400 font-bold">$ </span>{img.defaultStartup}
                      </div>
                    )}
                  </div>

                  {/* Action Bar */}
                  <div className="flex items-center justify-between gap-2 pt-4 mt-4 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                    <div className="flex items-center gap-1.5 text-[11px]" style={{ color: "var(--color-rp-text-muted)" }}>
                      <Server className="w-3.5 h-3.5" />
                      <span>{img._count?.servers ?? 0} servers</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <Link
                        href={`/servers?create=true&imageId=${img.id}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all"
                        style={{ backgroundColor: "var(--color-rp-accent)", color: "#000" }}
                      >
                        <Play className="w-3.5 h-3.5" />
                        <span>Launch</span>
                      </Link>

                      <button
                        onClick={() => handleQuickRemove(img.dockerImage, img.id)}
                        className="p-1.5 rounded-xl border text-red-400 hover:bg-red-500/15 transition-all"
                        style={{ borderColor: "var(--color-rp-border)" }}
                        title="Remove image"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 3: CUSTOM REGISTRY PULL FORM ─── */}
      {activeTab === "custom" && (
        <div className="max-w-2xl mx-auto rounded-3xl border p-6 md:p-8 space-y-6" style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}>
          <div className="flex items-center gap-3 border-b pb-5" style={{ borderColor: "var(--color-rp-border)" }}>
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-base md:text-lg" style={{ color: "var(--color-rp-text)" }}>
                Pull Custom Container Image from Online
              </h2>
              <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                Download from Docker Hub (`user/repo:tag`), GitHub (`ghcr.io/...`), Quay, or private registries.
              </p>
            </div>
          </div>

          {pullStatusMessage && (
            <div
              className={`p-4 rounded-2xl border text-xs flex items-center gap-3 ${
                pullStatusMessage.success
                  ? "bg-lime-950/20 border-lime-500/40 text-lime-300"
                  : "bg-red-950/20 border-red-500/40 text-red-300"
              }`}
            >
              {pullStatusMessage.success ? <CheckCircle2 className="w-5 h-5 text-lime-400 shrink-0" /> : <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
              <span>{pullStatusMessage.message}</span>
            </div>
          )}

          <form onSubmit={handlePullSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Display Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. My Python Discord Bot"
                  value={pullForm.name}
                  onChange={e => setPullForm(f => ({ ...f, name: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Category *
                </label>
                <select
                  value={pullForm.category}
                  onChange={e => setPullForm(f => ({ ...f, category: e.target.value as any }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  <option value="RUNTIME">Language Runtime (Python, Rust, Go, PHP, etc.)</option>
                  <option value="DATABASE">Database / Storage (MySQL, Postgres, Redis, etc.)</option>
                  <option value="WEB">Web Server / Proxy (Nginx, Caddy, Apache)</option>
                  <option value="GAME">Game Server (Minecraft, SteamCMD, Palworld)</option>
                  <option value="TOOL">Tool / AI (Ollama, PyTorch, Linux)</option>
                  <option value="CUSTOM">Custom OCI Image</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                Online Docker Image Tag / URL *
              </label>
              <input
                type="text"
                required
                placeholder="e.g. python:3.12-alpine, ghcr.io/org/repo:tag, mysql:8.0, redis:7-alpine"
                value={pullForm.dockerImage}
                onChange={e => setPullForm(f => ({ ...f, dockerImage: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Default Internal Port
                </label>
                <input
                  type="number"
                  value={pullForm.defaultPort}
                  onChange={e => setPullForm(f => ({ ...f, defaultPort: parseInt(e.target.value) || 8080, internalPort: parseInt(e.target.value) || 8080 }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none font-mono"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Target Node *
                </label>
                <select
                  value={pullForm.nodeId}
                  onChange={e => setPullForm(f => ({ ...f, nodeId: e.target.value }))}
                  className="w-full px-3.5 py-2.5 rounded-xl text-xs border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  <option value="">Global (All Nodes)</option>
                  {nodes.map(n => (
                    <option key={n.id} value={n.id}>
                      {n.name} ({n.isOnline || n.status === "ONLINE" ? "ONLINE" : "OFFLINE"})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                Default Startup Command (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. python -u main.py, cargo run --release, mysqld"
                value={pullForm.defaultStartup}
                onChange={e => setPullForm(f => ({ ...f, defaultStartup: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                Environment Variables (JSON Format)
              </label>
              <textarea
                rows={3}
                value={pullForm.environment}
                onChange={e => setPullForm(f => ({ ...f, environment: e.target.value }))}
                className="w-full px-3.5 py-2.5 rounded-xl text-xs font-mono border outline-none resize-none"
                style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
              />
            </div>

            <div className="pt-3">
              <button
                type="submit"
                disabled={pullSubmitting}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-xs font-bold transition-all shadow-md"
                style={{
                  backgroundColor: "var(--color-rp-accent)",
                  color: "#000",
                  opacity: pullSubmitting ? 0.7 : 1,
                }}
              >
                {pullSubmitting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                <span>{pullSubmitting ? "Downloading & Installing on Node..." : "Pull & Install Image on Node"}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ─── INSTALL / PULL MODAL ─── */}
      {showPullModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in">
          <div
            className="w-full max-w-xl rounded-3xl border p-6 md:p-8 shadow-2xl space-y-5"
            style={{ backgroundColor: "var(--color-rp-surface)", borderColor: "var(--color-rp-border)" }}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl flex items-center justify-center bg-lime-400/20 text-lime-400 border border-lime-400/30">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base md:text-lg" style={{ color: "var(--color-rp-text)" }}>
                    Install Container Image
                  </h3>
                  <p className="text-xs" style={{ color: "var(--color-rp-text-muted)" }}>
                    Target node daemon will pull `{pullForm.dockerImage}` and register it for server creation.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowPullModal(false)}
                className="p-2 rounded-xl border hover:bg-white/5 transition-all"
                style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text-muted)" }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {pullStatusMessage && (
              <div
                className={`p-3.5 rounded-xl border text-xs flex items-center gap-2.5 ${
                  pullStatusMessage.success
                    ? "bg-lime-950/20 border-lime-500/40 text-lime-300"
                    : "bg-red-950/20 border-red-500/40 text-red-300"
                }`}
              >
                {pullStatusMessage.success ? <CheckCircle2 className="w-4 h-4 text-lime-400 shrink-0" /> : <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />}
                <span>{pullStatusMessage.message}</span>
              </div>
            )}

            <form onSubmit={handlePullSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Display Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={pullForm.name}
                    onChange={e => setPullForm(f => ({ ...f, name: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Category
                  </label>
                  <select
                    value={pullForm.category}
                    onChange={e => setPullForm(f => ({ ...f, category: e.target.value as any }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <option value="RUNTIME">Language Runtime</option>
                    <option value="DATABASE">Database / Storage</option>
                    <option value="WEB">Web Server</option>
                    <option value="GAME">Game Server</option>
                    <option value="TOOL">Tool / AI</option>
                    <option value="CUSTOM">Custom OCI Image</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Docker Image URL / Tag *
                </label>
                <input
                  type="text"
                  required
                  value={pullForm.dockerImage}
                  onChange={e => setPullForm(f => ({ ...f, dockerImage: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Default Port
                  </label>
                  <input
                    type="number"
                    value={pullForm.defaultPort}
                    onChange={e => setPullForm(f => ({ ...f, defaultPort: parseInt(e.target.value) || 8080, internalPort: parseInt(e.target.value) || 8080 }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none font-mono"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                    Target Node *
                  </label>
                  <select
                    value={pullForm.nodeId}
                    onChange={e => setPullForm(f => ({ ...f, nodeId: e.target.value }))}
                    className="w-full px-3 py-2 rounded-xl text-xs border outline-none"
                    style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                  >
                    <option value="">Global (All Nodes)</option>
                    {nodes.map(n => (
                      <option key={n.id} value={n.id}>
                        {n.name} ({n.isOnline || n.status === "ONLINE" ? "ONLINE" : "OFFLINE"})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold block mb-1.5" style={{ color: "var(--color-rp-text)" }}>
                  Default Startup Command
                </label>
                <input
                  type="text"
                  value={pullForm.defaultStartup}
                  onChange={e => setPullForm(f => ({ ...f, defaultStartup: e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl text-xs font-mono border outline-none"
                  style={{ backgroundColor: "var(--color-rp-surface-2)", borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t" style={{ borderColor: "var(--color-rp-border)" }}>
                <button
                  type="button"
                  onClick={() => setShowPullModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold border transition-all"
                  style={{ borderColor: "var(--color-rp-border)", color: "var(--color-rp-text)" }}
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={pullSubmitting}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md"
                  style={{
                    backgroundColor: "var(--color-rp-accent)",
                    color: "#000",
                    opacity: pullSubmitting ? 0.7 : 1,
                  }}
                >
                  {pullSubmitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                  <span>{pullSubmitting ? "Pulling on Node..." : "Pull & Install Image"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
