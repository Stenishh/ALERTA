"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api";
import type { AlertStatus, FallAlert } from "@/types";

interface ApiFallAlert extends Omit<FallAlert, "detectedAt"> {
  detectedAt: string;
}

interface UseFallDetectionReturn {
  activeAlert: FallAlert | null;
  dismissAlert: () => Promise<void>;
  respondToAlert: () => Promise<void>;
}

export function useFallDetection(): UseFallDetectionReturn {
  const [activeAlert, setActiveAlert] = useState<FallAlert | null>(null);
  const activeAlertRef = useRef<FallAlert | null>(null);

  useEffect(() => {
    activeAlertRef.current = activeAlert;
  }, [activeAlert]);

  const checkForFall = useCallback(async () => {
    try {
      const alerts = await apiFetch<ApiFallAlert[]>("/api/alerts?status=pending");
      const latest = alerts[0];
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
  }, []);

  useEffect(() => {
    const initialCheck = window.setTimeout(() => void checkForFall(), 0);
    const interval = window.setInterval(() => void checkForFall(), 2000);
    return () => {
      window.clearTimeout(initialCheck);
      window.clearInterval(interval);
    };
  }, [checkForFall]);

  const resolveAlert = useCallback(async (status: AlertStatus) => {
    const alert = activeAlertRef.current;
    if (!alert || status === "pending") return;
    await apiFetch<ApiFallAlert>(`/api/alerts/${encodeURIComponent(alert.id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    setActiveAlert(null);
  }, []);

  const dismissAlert = useCallback(
    () => resolveAlert("dismissed"),
    [resolveAlert]
  );
  const respondToAlert = useCallback(
    () => resolveAlert("responded"),
    [resolveAlert]
  );

  return { activeAlert, dismissAlert, respondToAlert };
}
