"use client";

import { useEffect, useState } from "react";
import type { FallAlert } from "@/types";
import { AlertTriangle } from "lucide-react";

interface FallAlertModalProps {
  alert: FallAlert;
  onAcknowledge: () => Promise<void>;
}

export function FallAlertModal({ alert, onAcknowledge }: FallAlertModalProps) {
  const [isResolving, setIsResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const audio = new Audio("/alert.mp3");
    audio.volume = 0.7;
    audio.play().catch(() => {});
  }, []);

  const time = alert.detectedAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  async function handleAction(action: () => Promise<void>) {
    setIsResolving(true);
    setError(null);
    try {
      await action();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível atualizar o alerta."
      );
      setIsResolving(false);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-slate-950/75 z-40" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="fall-alert-title"
          className="bg-white rounded-3xl shadow-2xl ring-4 ring-red-500/40 w-full max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto"
        >

          {/* Cabeçalho vermelho */}
          <div className="bg-red-600 px-6 py-6 sm:px-10 sm:py-8 flex items-center gap-5">
            <AlertTriangle size={48} strokeWidth={2.5} className="text-white flex-shrink-0" />
            <div>
              <p id="fall-alert-title" className="text-white font-extrabold text-2xl sm:text-4xl leading-tight">QUEDA DETECTADA</p>
              <p className="text-white/90 text-base sm:text-lg font-medium mt-1">Alerta imediato — Resposta necessária</p>
            </div>
          </div>

          {/* Corpo */}
          <div className="px-6 py-6 sm:px-10 sm:py-8 flex flex-col gap-6 bg-white">

            {/* Dados do paciente */}
            <div className="flex items-center gap-5 bg-red-50 rounded-2xl p-5 border-2 border-red-200">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <span className="text-red-700 text-xl font-bold">
                  {alert.patientName.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </span>
              </div>
              <div className="min-w-0">
                <p className="text-slate-900 font-bold text-xl sm:text-2xl break-words">{alert.patientName}</p>
                <p className="text-slate-700 text-base sm:text-lg">{alert.location}</p>
                <p className="text-slate-600 text-sm sm:text-base mt-1">Detectado às {time}</p>
              </div>
            </div>

            <button
              onClick={() => void handleAction(onAcknowledge)}
              disabled={isResolving}
              className="w-full bg-red-600 hover:bg-red-700 active:scale-95 disabled:cursor-wait disabled:opacity-70 transition-all text-white font-bold text-lg sm:text-xl py-5 rounded-xl"
            >
              {isResolving ? "CONFIRMANDO..." : "OK — ENCERRAR ALERTA"}
            </button>

            {error && <p className="text-center text-red-700 text-base">{error}</p>}

            <p className="text-center text-slate-600 text-sm sm:text-base">
              Ao confirmar, a atividade do dispositivo voltará ao estado normal
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
