"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { DashboardMetrics, Patient } from "@/types";

interface UsePatientsReturn {
  patients: Patient[];
  metrics: DashboardMetrics;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function calculateMetrics(patients: Patient[]): DashboardMetrics {
  return {
    totalOnline: patients.filter((patient) => patient.status !== "offline").length,
    inMotion: patients.filter((patient) => patient.status === "moving").length,
    falls: patients.filter((patient) => patient.status === "fall_detected").length,
  };
}

export function usePatients(): UsePatientsReturn {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const data = await apiFetch<Patient[]>("/api/patients");
      setPatients(data);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível conectar ao backend."
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  const metrics = useMemo(() => calculateMetrics(patients), [patients]);

  return { patients, metrics, isLoading, error, refresh };
}

interface UsePatientReturn {
  patient: Patient | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function usePatient(id: string): UsePatientReturn {
  const [patient, setPatient] = useState<Patient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!id) return;
    try {
      const data = await apiFetch<Patient>(`/api/patients/${encodeURIComponent(id)}`);
      setPatient(data);
      setError(null);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "Não foi possível carregar o paciente."
      );
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  return { patient, isLoading, error, refresh };
}
