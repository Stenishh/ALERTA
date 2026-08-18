"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, Cpu } from "lucide-react";
import type { RiskLevel } from "@/types";
import { apiFetch } from "@/lib/api";

interface NewDeviceModalProps {
  onClose?: () => void;
}

const riskOptions: { value: RiskLevel; label: string; color: string }[] = [
  { value: "low", label: "Baixo Risco", color: "bg-emerald-500" },
  { value: "medium", label: "Médio Risco", color: "bg-amber-400" },
  { value: "high", label: "Alto Risco", color: "bg-red-500" },
];

export function NewDeviceModal({ onClose }: NewDeviceModalProps) {
  const router = useRouter();
  const [mac, setMac] = useState("");
  const [chipId, setChipId] = useState("");
  const [patientName, setPatientName] = useState("");
  const [ward, setWard] = useState("");
  const [room, setRoom] = useState("");
  const [bedId, setBedId] = useState("");
  const [riskLevel, setRiskLevel] = useState<RiskLevel>("low");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    if (onClose) {
      onClose();
    } else {
      router.back();
    }
  }

  async function handleSubmit() {
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiFetch("/api/devices", {
        method: "POST",
        body: JSON.stringify({
          deviceId: mac.trim(),
          chipId: chipId.trim(),
          patientName: patientName.trim(),
          ward: ward.trim(),
          room: room.trim(),
          bedId: bedId.trim(),
          riskLevel,
        }),
      });
      router.refresh();
      handleClose();
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível registrar o dispositivo."
      );
    } finally {
      setIsSaving(false);
    }
  }

  const isValid = mac.trim() !== "" && patientName.trim() !== "";

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={handleClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div
          style={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)" }}
          className="rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden border flex flex-col"
        >
          {/* Cabeçalho */}
          <div
            style={{ borderBottomColor: "var(--border)" }}
            className="flex items-center justify-between px-6 py-4 border-b"
          >
            <h2 style={{ color: "var(--text-primary)" }} className="font-bold text-base">
              Vincular Novo ALERTA
            </h2>
            <button onClick={handleClose} style={{ color: "var(--text-muted)" }} className="transition-colors">
              <X size={18} />
            </button>
          </div>

          {/* Corpo */}
          <div className="px-6 py-5 flex flex-col gap-5 overflow-y-auto">

            {/* MAC Address */}
            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Identificador Principal (MAC)
              </label>
              <input
                type="text"
                value={mac}
                onChange={(e) => setMac(e.target.value)}
                placeholder="Ex: 24:0A:C4:9A:58:33"
                style={{
                  backgroundColor: "var(--bg-card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors font-mono placeholder:text-slate-500"
              />
            </div>

            {/* Chip ID */}
            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Chip ID
                <span style={{ color: "var(--text-muted)" }} className="font-normal ml-1">(opcional)</span>
              </label>
              <div className="relative">
                <Cpu size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={chipId}
                  onChange={(e) => setChipId(e.target.value)}
                  placeholder="ID do chip"
                  style={{
                    backgroundColor: "var(--bg-card-inner)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border text-sm outline-none transition-colors placeholder:text-slate-500"
                />
              </div>
            </div>

            {/* Nome do paciente */}
            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Nome do Paciente
              </label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                placeholder="Digite o nome para vincular ao colete"
                style={{
                  backgroundColor: "var(--bg-card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none transition-colors placeholder:text-slate-500"
              />
            </div>

            {/* Localização */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                  Ala
                </label>
                <input
                  type="text"
                  value={ward}
                  onChange={(event) => setWard(event.target.value)}
                  placeholder="Ex: Ala B"
                  style={{
                    backgroundColor: "var(--bg-card-inner)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none placeholder:text-slate-500"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                  Quarto
                </label>
                <input
                  type="text"
                  value={room}
                  onChange={(event) => setRoom(event.target.value)}
                  placeholder="Ex: Quarto 102"
                  style={{
                    backgroundColor: "var(--bg-card-inner)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                  className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none placeholder:text-slate-500"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Identificação do leito
                <span style={{ color: "var(--text-muted)" }} className="font-normal ml-1">(opcional)</span>
              </label>
              <input
                type="text"
                value={bedId}
                onChange={(event) => setBedId(event.target.value)}
                placeholder="Ex: B102-A"
                style={{
                  backgroundColor: "var(--bg-card-inner)",
                  borderColor: "var(--border)",
                  color: "var(--text-primary)",
                }}
                className="w-full px-3 py-2.5 rounded-xl border text-sm outline-none placeholder:text-slate-500"
              />
            </div>

            {/* Grau de risco */}
            <div className="flex flex-col gap-2">
              <label style={{ color: "var(--text-secondary)" }} className="text-xs font-medium">
                Grau de Risco do Paciente
              </label>
              <div className="flex items-center gap-2">
                {riskOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setRiskLevel(option.value)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-semibold border transition-all ${
                      riskLevel === option.value
                        ? `${option.color} text-white border-transparent`
                        : "text-slate-500 border-slate-200"
                    }`}
                    style={
                      riskLevel !== option.value
                        ? { backgroundColor: "var(--bg-card-inner)", borderColor: "var(--border)", color: "var(--text-secondary)" }
                        : {}
                    }
                  >
                    <div className={`w-2 h-2 rounded-full ${riskLevel === option.value ? "bg-white" : option.color}`} />
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* Rodapé */}
          <div
            style={{ borderTopColor: "var(--border)" }}
            className="flex flex-col gap-2 px-6 py-4 border-t"
          >
            {error && <p className="text-center text-xs text-red-500">{error}</p>}
            <button
              onClick={handleSubmit}
              disabled={!isValid || isSaving}
              style={
                isValid
                  ? { backgroundColor: "var(--accent)", color: "#020617" }
                  : { backgroundColor: "var(--bg-card-inner)", color: "var(--text-muted)" }
              }
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold transition-all disabled:cursor-not-allowed"
            >
              <Cpu size={15} />
              {isSaving ? "Registrando..." : "Registrar Dispositivo"}
            </button>
            <p style={{ color: "var(--text-muted)" }} className="text-center text-xs">
              Ao registrar, o dispositivo iniciará o pareamento automaticamente.
            </p>
          </div>

        </div>
      </div>
    </>
  );
}
