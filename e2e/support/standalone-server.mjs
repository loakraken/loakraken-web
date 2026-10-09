// Production-like server for E2E_SERVER=standalone: `next build`, then the
// standalone server the container image ships (next.config output: "standalone").
// `next start` does not serve a standalone build, and the standalone folder has
// no static assets, so .next/static and public are copied next to server.js
// exactly like the production image does (ops O-4).
import { spawn, spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../..", import.meta.url));
const standalone = join(root, ".next", "standalone");
const port = process.env.PORT ?? "3202";

if (process.env.E2E_SKIP_BUILD !== "1") {
  const build = spawnSync("npx", ["next", "build"], { cwd: root, stdio: "inherit", shell: true });
  if (build.status !== 0) process.exit(build.status ?? 1);
}
if (!existsSync(join(standalone, "server.js"))) {
  console.error("standalone build missing: .next/standalone/server.js");
  process.exit(1);
}
for (const [from, to] of [
  [join(root, ".next", "static"), join(standalone, ".next", "static")],
  [join(root, "public"), join(standalone, "public")],
]) {
  rmSync(to, { recursive: true, force: true });
  if (existsSync(from)) cpSync(from, to, { recursive: true });
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: standalone,
  stdio: "inherit",
  env: { ...process.env, PORT: port, HOSTNAME: "127.0.0.1" },
});
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill(signal));
server.on("exit", (code) => process.exit(code ?? 0));
