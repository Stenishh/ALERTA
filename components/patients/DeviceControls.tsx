"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import type { Calibration, Patient } from "@/types";

interface DeviceControlsProps {
  patient: Patient;
  onReset: () => Promise<void>;
  onCalibrate: () => Promise<Calibration>;
}

export function DeviceControls({ patient, onReset, onCalibrate }: DeviceControlsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<"reset" | "calibrate" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [job, setJob] = useState<Calibration | null>(null);
  const [now, setNow] = useState(0);
  const current = job && patient.calibration?.id === job.id ? patient.calibration : job;
  const timedOut = current && now - Date.parse(current.requestedAt) > 30000;
  const phase = current && (current.status === "pending" || current.status === "running") && timedOut
    ? "timeout" : current?.status;
  const inProgress = phase === "pending" || phase === "running";
  const remaining = current?.startedAt
    ? Math.min(Math.ceil(current.durationMs / 1000), Math.max(0, Math.ceil((current.durationMs - (now - Date.parse(current.startedAt))) / 1000)))
    : Math.ceil((current?.durationMs ?? 10000) / 1000);
  const tracking = action === "calibrate" && current !== null;
  const offline = patient.status === "offline";

  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);

  useEffect(() => {
    if (!job || !inProgress) return;
    const timer = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [job, inProgress]);

  function open(nextAction: "reset" | "calibrate") {
    setError(null);
    setMessage(null);
    setJob(null);
    setAction(nextAction);
  }

  async function confirm() {
    if (!action || busy || offline) return;
    setBusy(true);
    setError(null);
    try {
      if (action === "calibrate") {
        const scheduled = await onCalibrate();
        setNow(Date.now());
        setJob(scheduled);
      } else {
        await onReset();
        setMessage("Reinício agendado. Aguarde a reconexão do dispositivo.");
        setAction(null);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Não foi possível enviar o comando.");
    } finally {
      setBusy(false);
    }
  }

  const buttonClass = "flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium hover:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed";
  const buttonStyle = { borderColor: "var(--border)", color: "var(--text-secondary)", backgroundColor: "var(--bg-card)" };

  return (
    <>
      <button onClick={() => open("calibrate")} disabled={busy || inProgress || offline} className={buttonClass} style={buttonStyle}>
        <Crosshair size={14} /> Calibrar sensor
      </button>
      <button onClick={() => open("reset")} disabled={busy || inProgress || offline} className={buttonClass} style={buttonStyle}>
        <RotateCcw size={14} /> Reiniciar dispositivo
      </button>
      {message && <p role="status" className="w-full text-right text-xs" style={{ color: "var(--text-muted)" }}>{message}</p>}
      <dialog
        ref={dialog}
        aria-labelledby="device-command-title"
        aria-describedby="device-command-description"
        onCancel={(event) => {
          event.preventDefault();
          if (!busy) setAction(null);
        }}
        className="m-auto w-full max-w-md rounded-2xl p-6 shadow-2xl backdrop:bg-black/50"
        style={{ backgroundColor: "var(--bg-card)", color: "var(--text-primary)" }}
      >
        <h2 id="device-command-title" className="text-lg font-bold">
          {action === "reset" ? "Reiniciar dispositivo?" : phase === "completed" ? "Calibração concluída!" : tracking ? "Calibração do sensor" : "Calibrar sensor?"}
        </h2>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{patient.name} · {patient.deviceId}</p>
        <div id="device-command-description" className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <p>{action === "reset"
            ? "O monitoramento será interrompido enquanto o dispositivo reinicia e se reconecta. Ao iniciar, ele calibrará o sensor por 10 segundos."
            : "O dispositivo coleta leituras por 10 segundos para calibrar o sensor. A detecção fica pausada nesse período."}</p>
          <p>Prenda o sensor no colete ou cinto na orientação definida. A pessoa pode se mover; breves momentos estáveis ajudam a precisão.</p>
        </div>
        {tracking && (
          <div role="status" aria-live="polite" className="mt-5 rounded-xl p-4 text-center" style={{ backgroundColor: "var(--bg-card-inner)" }}>
            {phase === "pending" && <><p>Aguardando o dispositivo iniciar…</p><p className="mt-2 text-sm">Tempo estimado de calibração: {remaining} segundos.</p></>}
            {phase === "running" && <>
              <p className="text-4xl font-bold tabular-nums">{remaining > 0 ? `${remaining}s` : "Aguarde…"}</p>
              <p className="mt-2 text-sm">{remaining > 0 ? "Calibrando o sensor." : "Aguardando a confirmação do dispositivo."}</p>
            </>}
            {phase === "completed" && <p className="font-semibold text-emerald-600">Calibração concluída com sucesso.</p>}
            {phase === "failed" && <p className="text-red-500">Não foi possível calibrar. Confira o sensor e tente novamente.</p>}
            {phase === "timeout" && <p className="text-amber-600">O dispositivo não confirmou a calibração no prazo. Confira a conexão e se a placa está com o firmware atualizado.</p>}
          </div>
        )}
        {(error || (offline && !tracking)) && <p role="alert" className="mt-3 text-sm text-red-500">{error || "O dispositivo está offline. Aguarde a reconexão."}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus disabled={busy} onClick={() => setAction(null)} className={buttonClass} style={buttonStyle}>{tracking ? "Fechar" : "Cancelar"}</button>
          {!tracking && <button disabled={busy || offline} onClick={() => void confirm()} className={`${buttonClass} bg-slate-800 text-white`}>
            {busy ? "Enviando..." : action === "reset" ? "Reiniciar" : "Iniciar calibração"}
          </button>}
        </div>
      </dialog>
    </>
  );
}
