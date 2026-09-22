import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const windows = process.platform === "win32";
const next = path.join(root, "node_modules/next/dist/bin/next");

function fail(message) {
  console.error(`\nALERTA: ${message}`);
  process.exit(1);
}

if (!existsSync(next)) {
  fail("Instale as dependências do site primeiro: npm install");
}

const candidates = ["backend/.venv", "venv", ".venv"].map((directory) =>
  path.join(root, directory, windows ? "Scripts/python.exe" : "bin/python")
);
candidates.push("python3", "python");
const python = candidates.find((command) =>
  spawnSync(command, ["-c", "import flask"], {
    cwd: root,
    stdio: "ignore",
  }).status === 0
);

if (!python) {
  fail(
    "Python com Flask não encontrado. Crie um ambiente com " +
    "python3 -m venv backend/.venv e instale as dependências com " +
    (windows ? "backend\\.venv\\Scripts\\python.exe" : "backend/.venv/bin/python") +
    " -m pip install -r backend/requirements.txt"
  );
}

function checkPort(port) {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once("error", (error) => {
      reject(new Error(error.code === "EADDRINUSE"
        ? `A porta ${port} já está em uso. Encerre a instância anterior e tente novamente.`
        : `Não foi possível usar a porta ${port}: ${error.message}`));
    });
    server.listen(port, "0.0.0.0", () => server.close(resolve));
  });
}

try {
  await Promise.all([checkPort(3000), checkPort(8080)]);
} catch (error) {
  fail(error.message);
}

const children = new Set();
let stopping = false;
let forceTimer;

function signalChild(child, signal) {
  if (!child.pid) return;
  try {
    if (windows) child.kill(signal);
    else process.kill(-child.pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") console.error(error.message);
  }
}

function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  console.log("\nEncerrando o site e a API...");
  for (const child of children) signalChild(child, "SIGTERM");
  forceTimer = setTimeout(() => {
    for (const child of children) signalChild(child, "SIGKILL");
  }, 3000);
  forceTimer.unref();
}

function start(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    detached: !windows,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  children.add(child);
  child.once("error", (error) => {
    console.error(`${name}: ${error.message}`);
    stop(1);
  });
  child.once("close", (code) => {
    children.delete(child);
    if (!stopping) {
      console.error(`${name} foi encerrado (código ${code}).`);
      stop(code || 1);
    }
    if (children.size === 0) clearTimeout(forceTimer);
  });
}

process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());

console.log("Iniciando ALERTA...");
console.log("Site: http://localhost:3000");
console.log("API:  http://localhost:8080");
console.log("Pressione Ctrl+C para encerrar os dois serviços.\n");
start("API", python, ["backend/app.py"]);
start("Site", process.execPath, [next, "dev", "--port", "3000"]);
