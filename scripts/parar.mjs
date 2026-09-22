import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { setTimeout } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");

function lsof(args) {
  const result = spawnSync("lsof", args, {
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !(result.status === 1 && !result.stderr.trim())) {
    throw new Error(result.stderr.trim() || "Falha ao consultar os processos.");
  }
  return result.stdout;
}

function listeners() {
  return [...new Set(lsof([
    "-nP", "-a", "-iTCP:3000,8080", "-sTCP:LISTEN", "-t",
  ]).trim().split(/\s+/).filter(Boolean).map(Number))];
}

function belongsToProject(pid) {
  const cwd = lsof(["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
    .split("\n").find((line) => line.startsWith("n"))?.slice(1);
  if (!cwd) return false;
  const directory = realpathSync(cwd);
  return directory === root || directory === path.join(root, "backend");
}

try {
  if (args.some((arg) => arg !== "--dry-run")) {
    throw new Error("Uso: npm run parar [-- --dry-run]");
  }
  const targets = [];
  for (const pid of listeners()) {
    if (belongsToProject(pid)) targets.push(pid);
    else console.log(`PID ${pid} ignorado: não foi possível associá-lo ao projeto ALERTA.`);
  }
  if (!targets.length) {
    console.log("Nenhum serviço do ALERTA encontrado nas portas 3000 e 8080.");
  } else if (dryRun) {
    console.log(`Seriam encerrados os processos: ${targets.join(", ")}.`);
  } else {
    for (const pid of targets) {
      // Consulta novamente antes de sinalizar, pois o processo pode já ter saído.
      if (!listeners().includes(pid) || !belongsToProject(pid)) continue;
      try {
        process.kill(pid, "SIGTERM");
        console.log(`Encerramento solicitado ao PID ${pid}.`);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    }
    let remaining = [];
    for (let attempt = 0; attempt < 20; attempt++) {
      remaining = listeners().filter((pid) => belongsToProject(pid));
      if (!remaining.length) break;
      await setTimeout(250);
    }
    if (remaining.length) {
      throw new Error(`Ainda há serviços em escuta (PIDs ${remaining.join(", ")}). Confira com npm run portas.`);
    }
    console.log("Serviços do ALERTA encerrados nas portas 3000 e 8080.");
  }
} catch (error) {
  console.error(`ALERTA: ${error.message}`);
  if (error.code === "ENOENT") {
    console.error("Este script requer lsof (disponível no macOS; instale-o no Linux).");
  }
  process.exitCode = 1;
}
