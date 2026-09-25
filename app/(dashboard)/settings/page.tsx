"use client";

import { SettingsForm } from "@/components/settings/SettingsForm";
import { useUnit } from "@/lib/unit-context";

export default function SettingsPage() {
  const { setUnitName } = useUnit();

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-black text-2xl" style={{ color: "var(--text-primary)" }}>
          Configurações do Sistema
        </h2>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Gerencie as preferências da unidade e relatórios de monitoramento
        </p>
      </div>
      <SettingsForm onUnitNameChange={setUnitName} />
    </div>
  );
}
