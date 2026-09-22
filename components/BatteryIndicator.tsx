import { Battery } from "lucide-react";
import type { Patient } from "@/types";

interface BatteryIndicatorProps {
  patient: Patient;
  compact?: boolean;
}

export function BatteryIndicator({ patient, compact = false }: BatteryIndicatorProps) {
  const level = patient.battery === null || !Number.isFinite(patient.battery)
    ? null
    : Math.round(Math.min(100, Math.max(0, patient.battery)));
  const isCritical = level !== null && patient.battery !== null && patient.battery < 20;
  const offline = patient.status === "offline";
  const color = offline ? "var(--text-muted)" : isCritical ? "#ef4444" : "#10b981";

  return (
    <div className={`flex flex-col gap-1 ${compact ? "items-start" : "items-center"}`}>
      <div className="flex items-center gap-1.5" style={{ color }}>
        <Battery size={compact ? 16 : 22} aria-hidden="true" />
        <span className={compact ? "text-xs font-semibold tabular-nums" : "text-2xl font-black tabular-nums"}>
          {level === null ? "--" : `${level}%`}
        </span>
      </div>
      {level !== null && (
        <div
          role="meter"
          aria-label={offline ? "Bateria — última leitura" : "Bateria"}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={level}
          className={`h-1.5 overflow-hidden rounded-full ${compact ? "w-14" : "w-24"}`}
          style={{ backgroundColor: "var(--border)" }}
        >
          <div className="h-full rounded-full transition-all" style={{ width: `${level}%`, backgroundColor: color }} />
        </div>
      )}
      {!compact && patient.batteryVoltage != null && Number.isFinite(patient.batteryVoltage) && (
        <span className="text-xs tabular-nums" style={{ color: "var(--text-secondary)" }}>
          {patient.batteryVoltage.toFixed(2)} V
        </span>
      )}
      {(level === null || offline || !compact) && (
        <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>
          {level === null ? "Sem leitura" : offline ? "Última leitura" : "Atualização automática"}
        </span>
      )}
      {isCritical && !offline && !compact && (
        <span className="text-[10px] font-semibold text-red-500">Bateria baixa</span>
      )}
    </div>
  );
}
