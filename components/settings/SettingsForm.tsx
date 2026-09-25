"use client";

import { useState } from "react";
import { Building2, Monitor, Bell, Save } from "lucide-react";
import { useUnit } from "@/lib/unit-context";

interface SettingsFormProps {
  onUnitNameChange: (name: string) => void;
}

export function SettingsForm({ onUnitNameChange }: SettingsFormProps) {
  const { unitName: currentUnitName, darkMode, setDarkMode } = useUnit();
  const [unitName, setUnitName] = useState(currentUnitName);
  const [criticalAlerts, setCriticalAlerts] = useState(true);
  const [volume, setVolume] = useState(50);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    onUnitNameChange(unitName);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="flex flex-col gap-4 max-w-2xl">

      {/* SEÇÃO 1 — Identificação da Unidade */}
      <div
        style={{
          backgroundColor: "var(--bg-card)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
        className="rounded-2xl border shadow-sm p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Building2 size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Identificação da Unidade
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Defina o nome oficial da ala para identificação nos relatórios e alertas em tempo real.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-medium uppercase tracking-widest" style={{ color: "var(--text-secondary)" }}>
            Nome da Unidade/Ala
          </label>
          <input
            type="text"
            value={unitName}
            onChange={(e) => setUnitName(e.target.value)}
            placeholder="Ex: Hospital Santa Casa — Ala Sul"
            style={{
              backgroundColor: "var(--bg-card-inner)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
            className="w-full px-4 py-3 rounded-xl border text-sm outline-none transition-colors placeholder:text-slate-400"
          />
        </div>
      </div>

      {/* SEÇÃO 2 — Preferências de Exibição */}
      <div
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        className="rounded-2xl border shadow-sm p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Monitor size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Preferências de Exibição
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Ajuste o brilho e as cores da interface para reduzir a fadiga ocular durante turnos noturnos.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base">🌙</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Modo Noturno (Dark Mode)
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Reduz o brilho para uso em plantões noturnos
              </span>
            </div>
          </div>
          <button
            onClick={() => setDarkMode(!darkMode)}
            style={{ backgroundColor: darkMode ? "#10b981" : "#e2e8f0" }}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
          >
            <div
              style={{ transform: darkMode ? "translateX(24px)" : "translateX(4px)" }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
            />
          </button>
        </div>
      </div>

      {/* SEÇÃO 3 — Alertas Sonoros */}
      <div
        style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
        className="rounded-2xl border shadow-sm p-6 flex flex-col gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Bell size={16} className="text-slate-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
              Alertas Sonoros
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
              Gerencie o volume e o tipo de notificação audível para detecções críticas de queda.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-base">🚨</span>
            <div className="flex flex-col">
              <span className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                Notificações Críticas
              </span>
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                Toca um alerta sonoro ao detectar queda
              </span>
            </div>
          </div>
          <button
            onClick={() => setCriticalAlerts(!criticalAlerts)}
            style={{ backgroundColor: criticalAlerts ? "#10b981" : "#e2e8f0" }}
            className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
          >
            <div
              style={{ transform: criticalAlerts ? "translateX(24px)" : "translateX(4px)" }}
              className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
            />
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Volume
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--text-secondary)" }}>
              {criticalAlerts ? `${volume}%` : "Desativado"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Silencioso</span>
            <input
              type="range"
              min={0}
              max={100}
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              disabled={!criticalAlerts}
              className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer accent-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
            />
            <span className="text-xs" style={{ color: "var(--text-muted)" }}>Máximo</span>
          </div>
        </div>
      </div>

      {/* RODAPÉ */}
      <div className="flex items-center justify-between">
        <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-muted)" }}>
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          Sincronizado com o Servidor Central
        </span>
        <button
          onClick={handleSave}
          style={{ backgroundColor: saved ? "#10b981" : "#1e293b" }}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all"
        >
          <Save size={14} />
          {saved ? "Salvo!" : "Salvar Alterações"}
        </button>
      </div>

    </div>
  );
}
