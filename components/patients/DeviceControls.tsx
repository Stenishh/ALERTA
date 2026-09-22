"use client";

import { useEffect, useRef, useState } from "react";
import { Crosshair, RotateCcw } from "lucide-react";
import type { Patient } from "@/types";

interface DeviceControlsProps {
  patient: Patient;
  onReset: () => Promise<void>;
  onCalibrate: () => Promise<void>;
}

export function DeviceControls({ patient, onReset, onCalibrate }: DeviceControlsProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [action, setAction] = useState<"reset" | "calibrate" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const offline = patient.status === "offline";

  useEffect(() => {
    if (action) dialog.current?.showModal();
    else dialog.current?.close();
  }, [action]);

  function open(nextAction: "reset" | "calibrate") {
    setError(null);
    setMessage(null);
    setAction(nextAction);
  }

  async function confirm() {
    if (!action || busy || offline) return;
    setBusy(true);
    setError(null);
    try {
      await (action === "reset" ? onReset() : onCalibrate());
      setMessage(action === "reset"
        ? "Reinício agendado. Aguarde a reconexão e permaneça em pé e parado durante a calibração."
        : "Calibração solicitada. Permaneça em pé e parado nos próximos segundos. Aguarde novas leituras; o envio do comando não confirma a conclusão.");
      setAction(null);
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
      <button onClick={() => open("calibrate")} disabled={busy || offline} className={buttonClass} style={buttonStyle}>
        <Crosshair size={14} /> Calibrar sensor
      </button>
      <button onClick={() => open("reset")} disabled={busy || offline} className={buttonClass} style={buttonStyle}>
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
          {action === "reset" ? "Reiniciar dispositivo?" : "Calibrar sensor?"}
        </h2>
        <p className="mt-2 text-xs" style={{ color: "var(--text-muted)" }}>{patient.name} · {patient.deviceId}</p>
        <div id="device-command-description" className="mt-4 space-y-3 text-sm" style={{ color: "var(--text-secondary)" }}>
          <p>{action === "reset"
            ? "O monitoramento será interrompido enquanto o dispositivo reinicia e se reconecta. Ao iniciar, ele fará uma nova calibração."
            : "A calibração ajusta a referência de postura para a posição atual do sensor e pausa brevemente a detecção."}</p>
          <p>Prenda o sensor no colete ou cinto. A pessoa deve estar em pé e permanecer parada durante a calibração.</p>
        </div>
        {(error || offline) && <p role="alert" className="mt-3 text-sm text-red-500">{error || "O dispositivo está offline. Aguarde a reconexão."}</p>}
        <div className="mt-6 flex justify-end gap-2">
          <button autoFocus disabled={busy} onClick={() => setAction(null)} className={buttonClass} style={buttonStyle}>Cancelar</button>
          <button disabled={busy || offline} onClick={() => void confirm()} className={`${buttonClass} bg-slate-800 text-white`}>
            {busy ? "Enviando..." : action === "reset" ? "Reiniciar" : "Iniciar calibração"}
          </button>
        </div>
      </dialog>
    </>
  );
}
