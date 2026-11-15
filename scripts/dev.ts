/**
 * `npm run dev`: the whole product with hot reload, on one origin.
 *
 *   web  Vite dev server   http://localhost:3000   (proxies /v1 to the API)
 *   api  tsx watch         http://localhost:3001   (PGlite by default; DATABASE_URL in apps/api/.env)
 *
 * Output is prefixed per process. When either process exits, the other is stopped too.
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";

const API_PORT = process.env.API_PORT ?? "3001";
const COLORS = { api: "\x1b[36m", web: "\x1b[35m" } as const;
const RESET = "\x1b[0m";

function start(name: keyof typeof COLORS, workspace: string, env: Record<string, string>): ChildProcess {
  // One command string (workspace names are constants): a shell is needed on Windows to run npm.cmd.
  const child = spawn(`npm run dev -w ${workspace}`, {
    env: { ...process.env, FORCE_COLOR: "1", ...env },
    shell: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
  const prefix = `${COLORS[name]}${name.padEnd(3)}${RESET} │ `;
  const forward = (stream: NodeJS.WriteStream) => (chunk: Buffer) => {
    for (const line of chunk.toString().split(/\r?\n/)) if (line.trim()) stream.write(prefix + line + "\n");
  };
  child.stdout?.on("data", forward(process.stdout));
  child.stderr?.on("data", forward(process.stderr));
  child.on("exit", (code) => stopAll(code ?? 0));
  return child;
}

let stopping = false;
const children: ChildProcess[] = [];

function stopAll(code: number) {
  if (stopping) return;
  stopping = true;
  for (const child of children) {
    if (child.exitCode !== null || !child.pid) continue;
    // On Windows the child is a shell; kill its whole tree so no server keeps holding a port.
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"]);
    else child.kill("SIGTERM");
  }
  process.exit(code);
}

/** Resolves once the API answers its health check, so the web server never proxies to nothing. */
async function apiReady(timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline && !stopping) {
    try {
      const response = await fetch(`http://127.0.0.1:${API_PORT}/v1/health`);
      if (response.ok) return true;
    } catch {
      // not listening yet
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  return false;
}

process.on("SIGINT", () => stopAll(0));
process.on("SIGTERM", () => stopAll(0));

children.push(start("api", "@ideaproxima/api", { PORT: API_PORT }));
if (!(await apiReady())) {
  console.error(`The API did not become healthy on port ${API_PORT}; see its output above.`);
  stopAll(1);
}
children.push(start("web", "@ideaproxima/web", { API_PORT }));
console.info(`\nideaproxima → http://localhost:3000  (API on :${API_PORT}, proxied at /v1)\n`);
