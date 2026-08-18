"use client";

import { useState } from "react";
import { X, Save } from "lucide-react";
import type { MedicalRecord, RiskLevel, Patient } from "@/types";

interface MedicalRecordModalProps {
  patient: Patient;
  existingRecord: MedicalRecord | null;
  onSave: (record: MedicalRecord) => Promise<void>;
  onClose: () => void;
}

const riskOptions: { value: RiskLevel; label: string; color: string }[] = [
  { value: "low", label: "Baixo", color: "bg-emerald-500" },
  { value: "medium", label: "Médio", color: "bg-amber-400" },
  { value: "high", label: "Alto", color: "bg-red-500" },
];

export function MedicalRecordModal({
  patient,
  existingRecord,
  onSave,
  onClose,
}: MedicalRecordModalProps) {
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(
    existingRecord?.riskLevel ?? "low"
  );
  const [responsible, setResponsible] = useState(existingRecord?.responsible ?? "");
  const [observations, setObservations] = useState(existingRecord?.observations ?? "");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setIsSaving(true);
    setError(null);
    try {
      await onSave({ riskLevel, responsible, observations });
      onClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível salvar as informações."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const initials = patient.name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          className="rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border"
        >
          {/* Cabeçalho */}
          <div
            style={{ borderBottomColor: "var(--border)" }}
            className="flex items-center justify-between px-6 py-4 border-b"
          >
            {error && <p className="mr-auto text-xs text-red-500">{error}</p>}
            <h2 style={{ color: "var(--text-primary)" }} className="font-bold text-base">
              Registrar Informações Médicas
            </h2>
            <button onClick={onClose} style={{ color: "var(--text-muted)" }}>
              <X size={18} />
            </button>
          </div>

          {/* Corpo */}
          <div className="px-6 py-5 flex flex-col gap-5">

            {/* Paciente + grau de risco */}
            <div className="flex items-start justify-between gap-4">
              <div className="flex flex-col gap-1">
                <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-widest">
                  Paciente
                </span>
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-[10px] font-bold">{initials}</span>
                  </div>
                  <span style={{ color: "var(--text-primary)" }} className="text-sm font-semibold">
                    {patient.name}
                  </span>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span style={{ color: "var(--text-muted)" }} className="text-[10px] uppercase tracking-widest">
                  Grau de Risco
                </span>
                <div className="flex items-center gap-1">
                  {riskOptions.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setRiskLevel(option.value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        riskLevel === option.value
                          ? `${option.color} text-white border-transparent`
                          : ""
                      }`}
                      style={
                        riskLevel !== option.value
                          ? { backgroundColor: "var(--bg-card-inner)", borderColor: "var(--border)", color: "var(--text-secondary)" }
                          : {}
                      }
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${riskLevel === option.value ? "bg-white" : option.color}`} />
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Responsável técnico */}
            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Responsável Técnico
                <span style={{ color: "var(--text-muted)" }} className="font-normal ml-1">(opcional)</span>
              </label>
              <input
                type="text"
                value={responsible}
                onChange={(e) => setResponsible(e.target.value)}
                placeholder="Nome do médico ou enfermeiro chefe"
                style={{
                  backgroundColor: "var(--bg-card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            {/* Observações clínicas */}
            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Observações Clínicas
              </label>
              <textarea
                value={observations}
                onChange={(e) => setObservations(e.target.value)}
                placeholder="Descreva sinais vitais, histórico recente ou recomendações específicas..."
                rows={4}
                style={{
                  backgroundColor: "var(--bg-card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors resize-none placeholder:text-slate-500"
              />
            </div>

          </div>

          {/* Rodapé */}
          <div
            style={{ borderTopColor: "var(--border)" }}
            className="flex items-center justify-end gap-2 px-6 py-4 border-t"
          >
            <button
              onClick={onClose}
              style={{ color: "var(--text-secondary)", backgroundColor: "var(--bg-card-inner)" }}
              className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              style={{ backgroundColor: "var(--accent)", color: "#020617" }}
              className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-colors"
            >
              <Save size={14} />
              {isSaving ? "Salvando..." : "Salvar Informações"}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
