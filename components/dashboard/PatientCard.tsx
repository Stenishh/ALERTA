import { BatteryIndicator } from "@/components/BatteryIndicator";
import Link from "next/link";
import Image from "next/image";
import { ChevronRight } from "lucide-react";
import type { Patient } from "@/types";

interface PatientCardProps {
  patient: Patient;
}

const statusConfig = {
  moving: {
    label: "ANDANDO",
    badge: "bg-emerald-500 text-white",
    dot: "bg-emerald-400",
    glow: "shadow-emerald-100",
  },
  stopped: {
    label: "PARADO",
    badge: "bg-amber-400 text-amber-900",
    dot: "bg-amber-400",
    glow: "shadow-amber-50",
  },
  fall_detected: {
    label: "QUEDA",
    badge: "bg-red-600 text-white",
    dot: "bg-red-500",
    glow: "shadow-red-100",
  },
  offline: {
    label: "OFFLINE",
    badge: "bg-slate-300 text-slate-600",
    dot: "bg-slate-400",
    glow: "",
  },
};

const riskConfig = {
  low: { label: "Baixo Risco", dot: "bg-emerald-500" },
  medium: { label: "Médio Risco", dot: "bg-amber-400" },
  high: { label: "Alto Risco", dot: "bg-red-500" },
};

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((n) => n[0])
    .join("")
    .toUpperCase();

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={44}
        height={44}
        unoptimized
        className="w-11 h-11 rounded-full object-cover ring-2 ring-slate-100"
      />
    );
  }

  return (
    <div className="w-11 h-11 rounded-full bg-slate-700 flex items-center justify-center ring-2 ring-slate-100 flex-shrink-0">
      <span className="text-white text-xs font-bold">{initials}</span>
    </div>
  );
}

export function PatientCard({ patient }: PatientCardProps) {
  const status = statusConfig[patient.status];
  const risk = riskConfig[patient.riskLevel];

  return (
    <div
      className="rounded-2xl shadow-sm p-5 flex flex-col gap-4 hover:shadow-md transition-all hover:-translate-y-0.5 "
      style={{
        backgroundColor: "var(--bg-card)",
        borderColor: "var(--border)",
        borderWidth: "1px",
      }}
    >
      {/* TOPO — ID + badge de status */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <div className={`w-2 h-2 rounded-full ${status.dot}`} />
          <span className="text-[11px] font-medium" style={{ color: "var(--text-muted)" }}>
            ID: {patient.deviceId}
          </span>
        </div>
        <span
          className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide ${status.badge}`}
        >
          {status.label}
        </span>
      </div>

      {/* MEIO — avatar + nome + localização */}
      <div className="flex items-center gap-3">
        <Avatar name={patient.name} avatarUrl={patient.avatarUrl} />
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-bold truncate" style={{ color: "var(--text-primary)" }}>
            {patient.name}
          </span>
          <span className="text-xs truncate mt-0.5" style={{ color: "var(--text-muted)" }}>
            {patient.ward} • {patient.room}
          </span>
          <div className="flex items-center gap-1.5 mt-1">
            <div className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
            <span className="text-[10px]" style={{ color: "var(--text-muted)" }}>{risk.label}</span>
          </div>
        </div>
      </div>

      {/* RODAPÉ — bateria + link */}
      <div
        className="flex items-center justify-between pt-2 border-t"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <BatteryIndicator patient={patient} compact />
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
            📶 {patient.wifiSignal === null || patient.wifiSignal === undefined ? "--" : `${Math.round(patient.wifiSignal)} dBm`}
          </span>
        </div>
        <Link
          href={`/patients/${patient.id}`}
          className="text-slate-300 hover:text-slate-600 transition-colors"
        >
          <ChevronRight size={16} />
        </Link>
      </div>
    </div>
  );
}
