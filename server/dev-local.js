import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const serverDirectory = fileURLToPath(new URL("./", import.meta.url));
const children = [
  spawn(process.execPath, ["index.js"], { cwd: serverDirectory, stdio: "inherit" }),
  spawn(process.execPath, ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", "--strictPort"], { cwd: root, stdio: "inherit" }),
];
let stopping = false;
function stop() {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (child.exitCode === null) child.kill("SIGTERM");
}
for (const child of children) {
  child.on("error", (error) => { console.error(error.message); process.exitCode = 1; stop(); });
  child.on("exit", (code) => {
    if (!stopping) { process.exitCode = code || 0; stop(); }
  });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
