import { Wifi, Battery, Timer, AlertTriangle } from "lucide-react";
import type { Patient } from "@/types";

interface TelemetryCardProps {
  patient: Patient;
}

const statusConfig = {
  moving: {
    label: "Em Movimento",
    description: "O paciente está caminhando pela ala.",
    icon: "🚶",
    color: "text-emerald-600",
    bg: "bg-emerald-50",
    border: "border-emerald-100",
  },
  stopped: {
    label: "Parado",
    description: "O paciente está sem movimento.",
    icon: "🧍",
    color: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-100",
  },
  fall_detected: {
    label: "Queda Detectada",
    description: "Alerta ativo — resposta necessária.",
    icon: "🚨",
    color: "text-red-600",
    bg: "bg-red-50",
    border: "border-red-100",
  },
  offline: {
    label: "Offline",
    description: "Colete sem conexão Wi-Fi.",
    icon: "📵",
    color: "text-slate-500",
    bg: "bg-slate-50",
    border: "border-slate-100",
  },
};

function WifiStrength({ signal }: { signal: number | null | undefined }) {
  if (signal === null || signal === undefined) {
    return (
      <div className="flex flex-col items-center gap-1 text-slate-400">
        <Wifi size={22} />
        <span className="text-xs font-semibold">-- dBm</span>
        <span className="text-[10px] uppercase tracking-wide">Sem leitura</span>
      </div>
    );
  }

  // Converte dBm em qualidade descritiva
  const quality =
    signal >= -60
      ? { label: "Excelente", color: "text-emerald-500" }
      : signal >= -70
      ? { label: "Bom", color: "text-emerald-400" }
      : signal >= -80
      ? { label: "Fraco", color: "text-amber-500" }
      : { label: "Crítico", color: "text-red-500" };

  return (
    <div className="flex flex-col items-center gap-1">
      <Wifi size={22} className={quality.color} />
      <span className={`text-xs font-semibold ${quality.color}`}>
        {Math.round(signal)} dBm
      </span>
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">
        {quality.label}
      </span>
    </div>
  );
}

function BatteryLevel({ level }: { level: number | null }) {
  const isCritical = level !== null && level < 20;
  const color = isCritical ? "text-red-500" : "text-slate-700";

  return (
    <div className="flex flex-col items-center gap-1">
      <Battery
        size={22}
        className={isCritical ? "text-red-500" : "text-slate-600"}
      />
      <span className={`text-2xl font-black tabular-nums ${color}`}>
        {level === null ? "--" : `${Math.round(level)}%`}
      </span>
      {isCritical && (
        <span className="text-[10px] text-red-500 font-semibold uppercase tracking-wide">
          Crítico
        </span>
      )}
    </div>
  );
}

export function TelemetryCard({ patient }: TelemetryCardProps) {
  const status = statusConfig[patient.status];
  const totalSeconds = patient.activityDurationSeconds ?? 0;
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const timeInActivity = [hours, minutes, seconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  const lastUpdate = patient.lastUpdate
    ? new Date(patient.lastUpdate).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "Sem dados";
  const fallsThisMonth = patient.fallsThisMonth ?? 0;

  return (
    <div
      className="rounded-2xl shadow-sm p-6 flex flex-col gap-6"
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        borderWidth: "1px",
      }}
    >

      {/* Cabeçalho */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Wifi size={16} style={{ color: "var(--text-muted)" }} />
          <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Telemetria em Tempo Real
          </span>
        </div>
        <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
          Atualizado: {lastUpdate}
        </span>
      </div>

      {/* Bateria + Wi-Fi */}
      <div
        className="flex items-center justify-around rounded-xl p-4 border"
        style={{
          backgroundColor: "var(--bg-card-inner)",
          borderColor: "var(--border)",
        }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Bateria
          </span>
          <BatteryLevel level={patient.battery} />
        </div>

        <div className="w-px h-12" style={{ backgroundColor: "var(--border)" }} />

        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] uppercase tracking-widest mb-1" style={{ color: "var(--text-muted)" }}>
            Sinal Wi-Fi
          </span>
          <WifiStrength signal={patient.wifiSignal} />
        </div>
      </div>

      {/* Tempo na atividade + quedas */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <Timer size={15} />
            <span className="text-xs">Tempo na atividade atual</span>
          </div>
          <span className="text-sm font-bold tabular-nums" style={{ color: "var(--text-primary)" }}>
            {timeInActivity}
          </span>
        </div>

        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            <AlertTriangle size={15} />
            <span className="text-xs">Quedas registradas (mês)</span>
          </div>
          <span
            className="text-sm font-bold tabular-nums"
            style={{
              color: fallsThisMonth > 0 ? "#ef4444" : "var(--text-primary)",
            }}
          >
            {fallsThisMonth}
          </span>
        </div>
      </div>

      {/* Status de atividade */}
      <div
        className={`rounded-xl p-4 border ${status.bg} ${status.border} flex items-center gap-4`}
      >
        <span className="text-3xl">{status.icon}</span>
        <div>
          <p className="text-[10px] uppercase tracking-widest mb-0.5" style={{ color: "var(--text-muted)" }}>
            Status de Atividade
          </p>
          <p className={`text-xl font-black ${status.color}`}>
            {status.label}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {status.description}
          </p>
        </div>
      </div>
    {/* Histórico de quedas */}
    <div
      className="rounded-xl p-4 border flex flex-col gap-3"
      style={{
        backgroundColor: "var(--bg-card-inner)",
        borderColor: "var(--border)",
      }}
    >
      <span className="text-[10px] uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
        Histórico de Quedas
      </span>

      {!patient.fallHistory || patient.fallHistory.length === 0 ? (
        <p className="text-xs" style={{ color: "var(--text-muted)" }}>Nenhuma queda registrada.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {patient.fallHistory.map((fall, i) => (
            <div
              key={i}
              className="flex items-center justify-between rounded-lg px-3 py-2 border"
              style={{
                borderColor: "var(--border)",
                backgroundColor: "var(--bg-card)",
              }}
            >
              <span className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
                {fall.date} às {fall.time}
              </span>
              <span className="text-[10px] font-bold text-red-600 uppercase tracking-wide">
                Queda
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
    </div>
  );
}
