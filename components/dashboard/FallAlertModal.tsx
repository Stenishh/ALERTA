"use client";

import { useEffect, useState } from "react";
import type { FallAlert } from "@/types";
import { AlertTriangle } from "lucide-react";

interface FallAlertModalProps {
  alert: FallAlert;
  onRespond: () => Promise<void>;
  onDismiss: () => Promise<void>;
}

export function FallAlertModal({ alert, onRespond, onDismiss }: FallAlertModalProps) {
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
      <div className="fixed inset-0 bg-black/60 z-40 animate-pulse" />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">

          {/* Cabeçalho vermelho */}
          <div className="bg-red-600 px-6 py-4 flex items-center gap-3">
            <AlertTriangle size={24} className="text-white flex-shrink-0" />
            <div>
              <p className="text-white font-bold text-lg leading-tight">QUEDA DETECTADA</p>
              <p className="text-red-200 text-xs">Alerta imediato — Resposta necessária</p>
            </div>
          </div>

          {/* Corpo */}
          <div className="px-6 py-5 flex flex-col gap-4 bg-white">

            {/* Dados do paciente */}
            <div className="flex items-center gap-3 bg-slate-50 rounded-xl p-3 border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center flex-shrink-0">
                <span className="text-slate-600 text-sm font-semibold">
                  {alert.patientName.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </span>
              </div>
              <div>
                <p className="text-slate-800 font-semibold text-sm">{alert.patientName}</p>
                <p className="text-slate-400 text-xs">{alert.location}</p>
                <p className="text-slate-400 text-xs mt-0.5">Detectado às {time}</p>
              </div>
            </div>

            {/* Botões */}
            <div className="flex gap-3">
              <button
                onClick={() => void handleAction(onRespond)}
                disabled={isResolving}
                className="flex-1 bg-red-600 hover:bg-red-700 active:scale-95 transition-all text-white font-bold text-sm py-3 rounded-xl"
              >
                RESPONDER AGORA
              </button>
              <button
                onClick={() => void handleAction(onDismiss)}
                disabled={isResolving}
                className="flex-1 active:scale-95 transition-all text-slate-700 font-medium text-sm py-3 rounded-xl border-2 border-slate-200 bg-white hover:bg-slate-50"
              >
                FALSO ALERTA
              </button>
            </div>

            {error && <p className="text-center text-red-500 text-xs">{error}</p>}

            <p className="text-center text-slate-400 text-xs">
              Este alerta não pode ser ignorado sem uma ação
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
