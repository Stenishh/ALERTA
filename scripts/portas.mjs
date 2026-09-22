import { spawnSync } from "node:child_process";
import { realpathSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = realpathSync(fileURLToPath(new URL("../", import.meta.url)));

function lsof(args) {
  const result = spawnSync("lsof", args, {
    encoding: "utf8",
    timeout: 10000,
    maxBuffer: 8 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  // lsof retorna 1 quando nenhum processo corresponde ao filtro.
  if (result.status !== 0 && !(result.status === 1 && !result.stderr.trim())) {
    throw new Error(result.stderr.trim() || "Não foi possível consultar o lsof.");
  }
  return result.stdout;
}

try {
  const output = lsof(["-nP", "-iTCP", "-sTCP:LISTEN", "-Fpcn"]);
  const listeners = [];
  let pid;
  let processName;
  for (const line of output.split("\n")) {
    const value = line.slice(1);
    if (line.startsWith("p")) pid = value;
    if (line.startsWith("c")) processName = value;
    if (line.startsWith("n")) {
      const port = Number(value.match(/:(\d+)$/)?.[1]);
      if (port && !listeners.some((item) => item.pid === pid && item.address === value)) {
        listeners.push({ pid, processName, address: value, port });
      }
    }
  }
  listeners.sort((a, b) => a.port - b.port || Number(a.pid) - Number(b.pid));

  const directories = new Map();
  for (const { pid } of listeners) {
    if (directories.has(pid)) continue;
    try {
      const cwd = lsof(["-a", "-p", pid, "-d", "cwd", "-Fn"])
        .split("\n").find((line) => line.startsWith("n"))?.slice(1);
      directories.set(pid, cwd ? realpathSync(cwd) : undefined);
    } catch {
      directories.set(pid, undefined);
    }
  }

  console.log("\nALERTA — portas TCP em escuta\n");
  if (listeners.length) {
    console.table(listeners.map((item) => ({
      Porta: item.port,
      Endereço: item.address,
      PID: item.pid,
      Processo: item.processName,
    })));
  } else {
    console.log("Nenhuma porta TCP em escuta visível para este usuário.");
  }

  console.log("\nServiços do projeto (portas usadas por npm run iniciar):");
  for (const service of [
    { name: "Frontend (Next.js)", port: 3000, source: "app" },
    { name: "Backend (Flask)", port: 8080, source: "backend/app.py" },
  ]) {
    const matches = listeners.filter((item) => item.port === service.port);
    console.log(`\n${service.name}: http://localhost:${service.port}`);
    console.log(`  Código: ${path.join(root, service.source)}`);
    if (!matches.length) {
      console.log("  Status: nenhuma escuta encontrada nesta porta.");
      continue;
    }
    for (const item of matches) {
      const cwd = directories.get(item.pid);
      const inProject = cwd && (cwd === root || cwd.startsWith(root + path.sep));
      console.log(`  Porta em uso: ${item.processName} (PID ${item.pid}), ${item.address}`);
      console.log(`  Diretório do processo: ${cwd || "indisponível"}`);
      console.log(inProject
        ? "  Processo iniciado neste projeto."
        : "  Não foi possível associar este processo ao projeto ALERTA.");
    }
  }
  console.log("\n* indica escuta em todas as interfaces. A lista depende das permissões do usuário.");
  console.log("Porta em escuta não confirma a saúde HTTP nem o acesso através do firewall.\n");
} catch (error) {
  console.error(`Não foi possível listar as portas: ${error.message}`);
  console.error("Este script requer lsof (disponível no macOS; instale-o no Linux).");
  process.exitCode = 1;
}
