import { spawn, type ChildProcess } from "node:child_process";

export type NativeBackupFormat = "sql" | "dump";
export type PgDumpStatus = { available: boolean; version?: string };
export type NativeBackupProcess = { child: ChildProcess; filename: string; contentType: string; release: () => void };
let nativeBackupRunning = false;

function databaseConnection() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("Database connection is not configured");
  let parsed: URL;
  try { parsed = new URL(databaseUrl); } catch { throw new Error("Database connection is invalid"); }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") throw new Error("Database connection must use PostgreSQL");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !parsed.username || !database) throw new Error("Database connection is incomplete");
  return { host: parsed.hostname, port: parsed.port || "5432", username: decodeURIComponent(parsed.username), password: decodeURIComponent(parsed.password), database };
}

export async function getPgDumpStatus(): Promise<PgDumpStatus> {
  return new Promise((resolve) => {
    const child = spawn("pg_dump", ["--version"], { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (chunk: Buffer) => { output += chunk.toString(); });
    child.once("error", () => resolve({ available: false }));
    child.once("close", (code) => resolve(code === 0 ? { available: true, version: output.trim().slice(0, 120) } : { available: false }));
  });
}

export function createNativeBackupProcess(format: NativeBackupFormat): NativeBackupProcess {
  if (nativeBackupRunning) throw new Error("A native PostgreSQL backup is already running");
  const connection = databaseConnection();
  const args = [format === "sql" ? "--format=plain" : "--format=custom", "--no-owner", "--no-privileges", "--host", connection.host, "--port", connection.port, "--username", connection.username, "--dbname", connection.database];
  nativeBackupRunning = true;
  let released = false;
  const release = () => { if (!released) { released = true; nativeBackupRunning = false; } };
  try {
    const child = spawn("pg_dump", args, { env: { ...process.env, PGPASSWORD: connection.password }, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
    const date = new Date().toISOString().slice(0, 10);
    return { child, filename: `buybit-postgres-${date}.${format === "sql" ? "sql" : "dump"}`, contentType: format === "sql" ? "application/sql; charset=utf-8" : "application/octet-stream", release };
  } catch (error) { release(); throw error; }
}
