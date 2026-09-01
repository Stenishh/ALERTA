"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Unlink, Pencil, AlertTriangle, RotateCcw, Trash2 } from "lucide-react";
import type { Patient } from "@/types";

interface PatientHeaderProps {
  patient: Patient;
  onEditMedicalRecord: () => void;
  onUnlink: () => Promise<void>;
  onDelete: () => Promise<void>;
  onReset: () => Promise<void>;
}

const statusConfig = {
  moving: { label: "Online", dot: "bg-emerald-400" },
  stopped: { label: "Online", dot: "bg-emerald-400" },
  fall_detected: { label: "Online", dot: "bg-red-400" },
  offline: { label: "Offline", dot: "bg-slate-400" },
};

export function PatientHeader({ patient, onEditMedicalRecord, onUnlink, onDelete, onReset }: PatientHeaderProps) {
  const status = statusConfig[patient.status];
  const [confirmAction, setConfirmAction] = useState<"unlink" | "delete" | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  async function handleConfirmedAction() {
    if (!confirmAction) return;
    setIsProcessing(true);
    setActionError(null);
    try {
      await (confirmAction === "delete" ? onDelete() : onUnlink());
      setConfirmAction(null);
    } catch (requestError) {
      setActionError(
        requestError instanceof Error
          ? requestError.message
          : confirmAction === "delete"
            ? "Não foi possível excluir o registro."
            : "Não foi possível desvincular o colete."
      );
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleReset() {
    if (!window.confirm(`Reiniciar o colete ${patient.deviceId}?`)) return;
    setIsResetting(true);
    setResetMessage(null);
    try {
      await onReset();
      setResetMessage("Reset agendado. O comando será entregue na próxima leitura.");
    } catch (requestError) {
      setResetMessage(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível agendar o reset."
      );
    } finally {
      setIsResetting(false);
    }
  }

  return (
    <>
      {/* Modal de confirmação de desvínculo/exclusão */}
      {confirmAction && (
        <>
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setConfirmAction(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" style={{ backgroundColor: "var(--bg-card)" }}>
              <div
                className="flex items-center gap-3 px-6 py-5 border-b"
                style={{ borderColor: "var(--border)" }}
              >
                <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle size={18} className="text-red-600" />
                </div>
                <div>
                  <h3 className="font-bold text-sm" style={{ color: "var(--text-primary)" }}>
                    {confirmAction === "delete" ? "Excluir Registro" : "Desvincular Colete"}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    {confirmAction === "delete"
                      ? "O cadastro e o histórico associado serão apagados"
                      : "O colete ficará disponível para outro paciente"}
                  </p>
                </div>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                  {confirmAction === "delete" ? (
                    <>
                      Excluir permanentemente o registro de{" "}
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>{patient.name}</span>?
                    </>
                  ) : (
                    <>
                      Desvincular o colete{" "}
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>{patient.deviceId}</span> do paciente{" "}
                      <span className="font-bold" style={{ color: "var(--text-primary)" }}>{patient.name}</span>?
                    </>
                  )}
                </p>
                {actionError && <p className="text-xs text-red-500 mt-3">{actionError}</p>}
              </div>
              <div
                className="flex items-center gap-2 px-6 py-4 border-t"
                style={{ borderColor: "var(--border)" }}
              >
                <button
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors hover:opacity-80"
                  style={{
                    backgroundColor: "var(--bg-card-inner)",
                    color: "var(--text-secondary)",
                    borderColor: "var(--border)",
                    borderWidth: "1px",
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => void handleConfirmedAction()}
                  disabled={isProcessing}
                  className="flex-1 py-2.5 rounded-xl text-sm text-white bg-red-600 hover:bg-red-700 font-bold transition-colors"
                >
                  {isProcessing
                    ? "Processando..."
                    : confirmAction === "delete"
                      ? "Sim, excluir"
                      : "Sim, desvincular"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-sm transition-colors hover:opacity-80" style={{ color: "var(--text-muted)" }}>
            <ArrowLeft size={15} />
            Retornar para o Painel
          </Link>
          <span className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>Monitoramento de Colete</span>
        </div>

        <div
          className="rounded-2xl shadow-sm px-6 py-5 flex items-center justify-between"
          style={{
            backgroundColor: "var(--bg-card)",
            borderColor: "var(--border)",
            borderWidth: "1px",
          }}
        >
          <div className="flex items-center gap-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-slate-800 text-white text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide">
                  Colete Ativo: {patient.deviceId}
                </span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status.dot} animate-pulse`} />
                  <span className="text-xs font-medium text-emerald-500">{status.label}</span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {patient.name.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()}
                  </span>
                </div>
                <div>
                  <h1 className="text-xl font-black" style={{ color: "var(--text-primary)" }}>{patient.name}</h1>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                    Internação: {patient.ward} • {patient.room}
                    {patient.bedId ? ` • ID: ${patient.bedId}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            {resetMessage && (
              <span className="max-w-48 text-right text-[10px]" style={{ color: "var(--text-muted)" }}>
                {resetMessage}
              </span>
            )}
            <button
              onClick={() => void handleReset()}
              disabled={isResetting || patient.status === "offline"}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ borderColor: "var(--border)" }}
            >
              <RotateCcw size={14} className={isResetting ? "animate-spin" : ""} />
              {isResetting ? "Agendando..." : "Reiniciar Colete"}
            </button>
            <button
              onClick={onEditMedicalRecord}
              className="flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 text-sm font-medium transition-all"
            >
              <Pencil size={14} />
              Editar Ficha
            </button>
            <button
              onClick={() => {
                setActionError(null);
                setConfirmAction("unlink");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 hover:bg-red-100 border border-red-100 text-red-600 text-sm font-medium transition-all"
            >
              <Unlink size={14} />
              Desvincular Colete
            </button>
            <button
              onClick={() => {
                setActionError(null);
                setConfirmAction("delete");
              }}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 border border-red-700 text-white text-sm font-medium transition-all"
            >
              <Trash2 size={14} />
              Excluir Registro
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
