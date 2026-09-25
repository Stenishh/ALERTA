import { FileText, Plus } from "lucide-react";
import type { MedicalRecord } from "@/types";

interface MedicalRecordCardProps {
  record: MedicalRecord | null;
  onAdd: () => void;
}

const riskConfig = {
  low: {
    label: "Baixo Risco",
    bg: "bg-emerald-50",
    text: "text-emerald-700",
    border: "border-emerald-100",
    dot: "bg-emerald-500",
  },
  medium: {
    label: "Médio Risco",
    bg: "bg-amber-50",
    text: "text-amber-700",
    border: "border-amber-100",
    dot: "bg-amber-400",
  },
  high: {
    label: "Alto Risco",
    bg: "bg-red-50",
    text: "text-red-700",
    border: "border-red-100",
    dot: "bg-red-500",
  },
};

export function MedicalRecordCard({ record, onAdd }: MedicalRecordCardProps) {
  return (
    <div
      className="rounded-2xl shadow-sm p-6 flex flex-col gap-5"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        borderWidth: "1px",
      }}
    >

      {/* Cabeçalho */}
      <div className="flex items-center gap-2">
        <FileText size={16} style={{ color: "var(--text-muted)" }} />
        <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Informações do Prontuário
        </span>
      </div>

      {/* Sem ficha — botão de adicionar */}
      {!record ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 py-10">
          <button
            onClick={onAdd}
            className="w-12 h-12 rounded-full hover:opacity-80 flex items-center justify-center transition-all hover:scale-105"
            style={{
              backgroundColor: "var(--bg-card-inner)",
            }}
          >
            <Plus size={22} style={{ color: "var(--text-secondary)" }} />
          </button>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Adicionar Informações Médicas
          </p>
        </div>
      ) : (
        // Com ficha — exibe os dados
        <div className="flex flex-col gap-4">

          {/* Grau de risco */}
          {(() => {
            const risk = riskConfig[record.riskLevel];
            return (
              <div
                className={`risk-panel flex items-center gap-2 px-3 py-2 rounded-xl border ${risk.bg} ${risk.border}`}
              >
                <div className={`w-2.5 h-2.5 rounded-full ${risk.dot}`} />
                <span className={`risk-label text-sm font-bold ${risk.text}`}>
                  {risk.label}
                </span>
              </div>
            );
          })()}

          {/* Responsável técnico */}
          {record.responsible && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Responsável Técnico
              </span>
              <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                {record.responsible}
              </span>
            </div>
          )}

          {/* Observações clínicas */}
          {record.observations && (
            <div className="flex flex-col gap-1">
              <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
                Observações Clínicas
              </span>
              <div className="flex flex-col gap-2">
                {record.observations.split(/\n\s*\n/).filter(Boolean).map((observation, index) => (
                  <p
                    key={index}
                    className="text-sm leading-relaxed whitespace-pre-wrap break-words rounded-xl p-3 border"
                    style={{
                      color: "var(--text-secondary)",
                      backgroundColor: "var(--bg-card-inner)",
                      borderColor: "var(--border)",
                    }}
                  >
                    {observation}
                  </p>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  );
}
