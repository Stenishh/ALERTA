"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { FallAlert } from "@/types";

interface ApiFallAlert extends Omit<FallAlert, "detectedAt"> {
  detectedAt: string;
}

interface UseFallDetectionReturn {
  activeAlert: FallAlert | null;
  acknowledgeAlert: () => Promise<void>;
}

export function useFallDetection(patientId?: string): UseFallDetectionReturn {
  const [activeAlert, setActiveAlert] = useState<FallAlert | null>(null);
  const activeAlertRef = useRef<FallAlert | null>(null);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  const checkForFall = useCallback(async () => {
    try {
      const alerts = await apiFetch<ApiFallAlert[]>("/api/alerts?status=pending");
      const latest = patientId
        ? alerts.find((alert) => alert.patientId === patientId)
        : alerts[0];
      if (!latest) {
        setActiveAlert(null);
        return;
      }
      if (activeAlertRef.current?.id !== latest.id) {
        setActiveAlert({ ...latest, detectedAt: new Date(latest.detectedAt) });
      }
    } catch {
      // O painel continua utilizável durante uma interrupção temporária da API.
    }
  }, [patientId]);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkForFall(), 0);
    const interval = window.setInterval(() => void checkForFall(), 750);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [checkForFall]);

  const acknowledgeAlert = useCallback(async () => {
    const alert = activeAlertRef.current;
    if (!alert) return;
    await apiFetch<ApiFallAlert>(`/api/alerts/${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status: "responded" }),
    });
    activeAlertRef.current = null;
    setActiveAlert(null);
  }, []);

  return { activeAlert, acknowledgeAlert };
}
