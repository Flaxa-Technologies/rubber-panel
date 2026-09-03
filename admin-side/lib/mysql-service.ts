import mysql from "mysql2/promise";
import crypto from "crypto";
import { db } from "./db";

interface MysqlConnectionConfig {
  host: string;
  port: number;
  user: string;
  password?: string;
}

async function getMysqlConfig(nodeId?: string): Promise<MysqlConnectionConfig> {
  // 1. Check if a DatabaseHost is configured in the panel
  if (nodeId) {
    const nodeHost = await db.databaseHost.findFirst({
      where: { nodeId },
    });
    if (nodeHost) {
      return {
        host: nodeHost.host,
        port: nodeHost.port,
        user: nodeHost.username,
        password: nodeHost.password,
      };
    }
  }

  const defaultHost = await db.databaseHost.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (defaultHost) {
    return {
      host: defaultHost.host,
      port: defaultHost.port,
      user: defaultHost.username,
      password: defaultHost.password,
    };
  }

  // 2. Fallback to environment variables or local host
  return {
    host: process.env.MYSQL_HOST || "127.0.0.1",
    port: parseInt(process.env.MYSQL_PORT || "3306", 10),
    user: process.env.MYSQL_USER || "root",
    password: process.env.MYSQL_PASSWORD || "",
  };
}

export async function testMysqlConnection(cfg?: MysqlConnectionConfig): Promise<{ success: boolean; message?: string }> {
  try {
    const config = cfg || await getMysqlConfig();
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      connectTimeout: 5000,
    });
    await conn.ping();
    await conn.end();
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err?.message || "Connection failed" };
  }
}

// Create MySQL database and dedicated user for a game server
export async function createDatabaseForServer(params: {
  serverId: string;
  nameSuffix: string;
  connectionsFrom?: string;
  nodeId?: string;
}) {
  const server = await db.server.findUnique({
    where: { id: params.serverId },
    include: {
      node: true,
      databases: true,
    },
  });

  if (!server) {
    throw new Error("Server not found");
  }

  // Enforce server database limit
  const limit = server.databaseLimit ?? 0;
  if (limit <= 0) {
    throw new Error("Database creation is not enabled for this server (limit is 0). Contact an administrator.");
  }

  if (server.databases.length >= limit) {
    throw new Error(`Database limit reached. This server can only have up to ${limit} databases.`);
  }

  // Sanitize suffix
  const cleanSuffix = params.nameSuffix.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 16) || "db";
  const shortId = (server.uuid || server.id).replace(/-/g, "").slice(0, 8);
  const dbName = `s_${shortId}_${cleanSuffix}`;
  const dbUser = `u_${shortId}_${cleanSuffix.slice(0, 7)}`;
  const connectionsFrom = params.connectionsFrom?.trim() || "%";
  const password = crypto.randomBytes(18).toString("base64url");

  const config = await getMysqlConfig(server.nodeId);
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  try {
    // 1. Create Database
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);

    // 2. Create User
    await conn.query(`CREATE USER IF NOT EXISTS '${dbUser}'@'${connectionsFrom}' IDENTIFIED BY ?;`, [password]);
    await conn.query(`ALTER USER '${dbUser}'@'${connectionsFrom}' IDENTIFIED BY ?;`, [password]);

    // 3. Grant Permissions
    await conn.query(`GRANT ALL PRIVILEGES ON \`${dbName}\`.* TO '${dbUser}'@'${connectionsFrom}';`);
    await conn.query(`FLUSH PRIVILEGES;`);
  } finally {
    await conn.end().catch(() => {});
  }

  // Public endpoint for user connections
  const endpointHost = server.node?.fqdn || (config.host === "127.0.0.1" ? "127.0.0.1" : config.host);

  // Save to Prisma DB
  const record = await db.serverDatabase.create({
    data: {
      serverId: server.id,
      name: dbName,
      databaseUser: dbUser,
      password,
      host: endpointHost,
      port: config.port,
      connectionsFrom,
    },
  });

  return record;
}

// Rotate password for an existing server database
export async function rotateDatabasePassword(databaseId: string) {
  const dbRecord = await db.serverDatabase.findUnique({
    where: { id: databaseId },
    include: { server: true },
  });

  if (!dbRecord) throw new Error("Database not found");

  const newPassword = crypto.randomBytes(18).toString("base64url");
  const config = await getMysqlConfig(dbRecord.server.nodeId);
  const conn = await mysql.createConnection({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
  });

  try {
    await conn.query(`ALTER USER '${dbRecord.databaseUser}'@'${dbRecord.connectionsFrom}' IDENTIFIED BY ?;`, [newPassword]);
    await conn.query(`FLUSH PRIVILEGES;`);
  } finally {
    await conn.end().catch(() => {});
  }

  const updated = await db.serverDatabase.update({
    where: { id: databaseId },
    data: { password: newPassword },
  });

  return updated;
}

// Delete database and credentials
export async function deleteServerDatabase(databaseId: string) {
  const dbRecord = await db.serverDatabase.findUnique({
    where: { id: databaseId },
    include: { server: true },
  });

  if (!dbRecord) throw new Error("Database not found");

  const config = await getMysqlConfig(dbRecord.server.nodeId);
  try {
    const conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
    });

    try {
      await conn.query(`DROP DATABASE IF EXISTS \`${dbRecord.name}\`;`);
      await conn.query(`DROP USER IF EXISTS '${dbRecord.databaseUser}'@'${dbRecord.connectionsFrom}';`);
      await conn.query(`FLUSH PRIVILEGES;`);
    } finally {
      await conn.end().catch(() => {});
    }
  } catch (err: any) {
    console.warn(`[MysqlService] Could not drop MySQL database on host: ${err?.message}`);
  }

  await db.serverDatabase.delete({
    where: { id: databaseId },
  });

  return { success: true };
}
