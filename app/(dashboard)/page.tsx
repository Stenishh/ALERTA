"use client";

import { useState } from "react";
import { usePatients } from "@/hooks/usePatients";
import { useFallDetection } from "@/hooks/useFallDetection";
import { PatientCard } from "@/components/dashboard/PatientCard";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { FallAlertModal } from "@/components/dashboard/FallAlertModal";
import { Search, LayoutGrid, List } from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const { patients, metrics, isLoading, error } = usePatients();
  const { activeAlert, respondToAlert, dismissAlert } = useFallDetection();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const filteredPatients = patients.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.deviceId.toLowerCase().includes(search.toLowerCase())
  );
  const lowBatteryDevices = patients.filter(
    (patient) => patient.battery !== null && patient.battery < 20
  );
  const offlineDevices = patients.filter((patient) => patient.status === "offline");

  return (
    <div className="flex flex-col h-full gap-6">

      {/* POP-UP DE QUEDA — sobrepõe tudo quando ativo */}
      {activeAlert && (
        <FallAlertModal
          alert={activeAlert}
          onRespond={respondToAlert}
          onDismiss={dismissAlert}
        />
      )}

      {/* HEADER */}
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>
          Painel Geral — Monitoramento em Tempo Real
        </h2>
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2 shadow-sm border"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border)",
            }}
          >
            <Search size={14} style={{ color: "var(--text-muted)" }} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar paciente ou ID do colete..."
              className="text-sm outline-none w-64"
              style={{
                backgroundColor: "transparent",
                color: "var(--text-primary)",
              }}
            />
          </div>
          <div
            className="flex items-center rounded-lg shadow-sm overflow-hidden border"
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--border)",
            }}
          >
            <button
              onClick={() => setViewMode("grid")}
              className="p-2 transition-colors"
              style={{
                backgroundColor:
                  viewMode === "grid" ? "var(--text-primary)" : "transparent",
                color: viewMode === "grid" ? "white" : "var(--text-muted)",
              }}
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setViewMode("list")}
              className="p-2 transition-colors"
              style={{
                backgroundColor:
                  viewMode === "list" ? "var(--text-primary)" : "transparent",
                color: viewMode === "list" ? "white" : "var(--text-muted)",
              }}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Backend indisponível: {error}
        </div>
      )}

    {/* MÉTRICAS */}
<div className="flex items-center gap-4">
  <MetricCard label="Total Online" value={metrics.totalOnline} highlight="success" />
  <MetricCard label="Em Movimento" value={metrics.inMotion} highlight="warning" />
  <MetricCard
    label="Quedas"
    value={metrics.falls}
    highlight={metrics.falls > 0 ? "danger" : "success"}
  />
</div>

      {/* GRID DE PACIENTES */}
      {isLoading ? (
        <div className="grid grid-cols-3 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl shadow-sm p-4 h-40 animate-pulse border"
              style={{
                backgroundColor: "var(--bg-card)",
                borderColor: "var(--border)",
              }}
            />
          ))}
        </div>
      ) : filteredPatients.length === 0 ? (
        <div className="flex-1 flex flex-col gap-3 items-center justify-center">
          <p className="text-slate-400 text-sm">
            {search
              ? `Nenhum paciente encontrado para "${search}"`
              : "Nenhum dispositivo enviou dados ou foi vinculado ainda."}
          </p>
          {!search && (
            <Link
              href="/devices/new"
              className="bg-sky-500 hover:bg-sky-600 text-white text-xs font-medium px-4 py-2 rounded-lg"
            >
              Vincular dispositivo
            </Link>
          )}
        </div>
      ) : (
        <div
          className={
            viewMode === "grid"
              ? "grid grid-cols-3 gap-6"
              : "flex flex-col gap-3"
          }
        >
          {filteredPatients.map((patient) => (
            <PatientCard key={patient.id} patient={patient} />
          ))}
        </div>
      )}

      {/* SAÚDE REAL DOS DISPOSITIVOS */}
      <div className="mt-auto bg-slate-900 rounded-xl px-5 py-3 flex items-center gap-6">
        <span className="text-white text-xs font-medium uppercase tracking-widest flex-shrink-0">
          🔔 Saúde dos Dispositivos
        </span>
        <div className="flex items-center gap-6 flex-1 overflow-hidden">
          {lowBatteryDevices.length === 0 && offlineDevices.length === 0 ? (
            <span className="text-emerald-300 text-xs whitespace-nowrap">
              Nenhum alerta ativo
            </span>
          ) : (
            <>
              {lowBatteryDevices.map((patient) => (
                <span key={`battery-${patient.id}`} className="text-amber-300 text-xs whitespace-nowrap">
                  🔋 {patient.deviceId}: bateria em {patient.battery}%
                </span>
              ))}
              {offlineDevices.map((patient) => (
                <span key={`offline-${patient.id}`} className="text-slate-300 text-xs whitespace-nowrap">
                  📵 {patient.deviceId}: offline
                </span>
              ))}
            </>
          )}
        </div>
        <Link
          href="/devices/new"
          className="bg-sky-500 hover:bg-sky-600 transition-colors text-white text-xs font-medium px-4 py-2 rounded-lg flex-shrink-0"
        >
          Vincular Dispositivo
        </Link>
      </div>
    </div>
  );
}
