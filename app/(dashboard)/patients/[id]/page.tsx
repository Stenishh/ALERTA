"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { usePatient } from "@/hooks/usePatients";
import { apiFetch } from "@/lib/api";
import { PatientHeader } from "@/components/patients/PatientHeader";
import { TelemetryCard } from "@/components/patients/TelemetryCard";
import { MedicalRecordCard } from "@/components/patients/MedicalRecordCard";
import { MedicalRecordModal } from "@/components/patients/MedicalRecordModal";
import type { MedicalRecord } from "@/types";

export default function PatientPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { patient, isLoading, error, refresh } = usePatient(id);

  const [isModalOpen, setIsModalOpen] = useState(false);

  async function saveMedicalRecord(record: MedicalRecord) {
    await apiFetch(`/api/patients/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ medicalRecord: record }),
    });
    await refresh();
  }

  async function unlinkDevice() {
    await apiFetch(`/api/patients/${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    router.push("/");
  }

  async function resetDevice() {
    await apiFetch(`/api/devices/${encodeURIComponent(id)}/reset`, {
      method: "POST",
    });
  }

  if (isLoading) {
    return <div className="flex-1 rounded-2xl animate-pulse" style={{ backgroundColor: "var(--bg-card)" }} />;
  }

  if (!patient) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">{error ?? "Paciente não encontrado."}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 h-full">

      {/* Modal de ficha médica */}
      {isModalOpen && (
        <MedicalRecordModal
          patient={patient}
          existingRecord={patient.medicalRecord ?? null}
          onSave={saveMedicalRecord}
          onClose={() => setIsModalOpen(false)}
        />
      )}

      {/* Cabeçalho do paciente */}
      <PatientHeader
        patient={patient}
        onEditMedicalRecord={() => setIsModalOpen(true)}
        onUnlink={unlinkDevice}
        onReset={resetDevice}
      />

      {/* Conteúdo principal — telemetria + prontuário */}
      <div className="grid grid-cols-2 gap-6 flex-1">
        <TelemetryCard patient={patient} />
        <MedicalRecordCard
          record={patient.medicalRecord ?? null}
          onAdd={() => setIsModalOpen(true)}
        />
      </div>

    </div>
  );
}
