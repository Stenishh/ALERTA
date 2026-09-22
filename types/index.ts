// ============================================================
// DOMÍNIO: PACIENTE (vindo da API Flask)
// ============================================================

export type PatientStatus =
  | "moving"
  | "stopped"
  | "fall_detected"
  | "offline";

export type RiskLevel = "low" | "medium" | "high";

export interface Calibration {
  id: string;
  status: "pending" | "running" | "completed" | "failed" | "timeout";
  durationMs: number;
  requestedAt: string;
  startedAt: string | null;
}

export interface Patient {
  id: string;
  name: string;
  ward: string;
  room: string;
  status: PatientStatus;
  riskLevel: RiskLevel;
  deviceId: string;
  battery: number | null;
  calibration?: Calibration | null;
  batteryVoltage?: number | null;
  wifiSignal?: number | null;
  bedId?: string;
  avatarUrl?: string;
  fallHistory?: FallRecord[];
  lastUpdate?: string | null;
  rawStatus?: string;
  checkpoint?: number | null;
  activityDurationSeconds?: number;
  fallsThisMonth?: number;
  medicalRecord?: MedicalRecord | null;
  registered?: boolean;
}

// ============================================================
// DOMÍNIO: ALERTA DE QUEDA
// ============================================================

export type AlertStatus =
  | "pending"
  | "responded"
  | "dismissed";

export interface FallAlert {
  id: string;
  patientId: string;
  patientName: string;
  location: string;       // "Ala B • Quarto 102"
  detectedAt: Date;
  status: AlertStatus;
  respondedBy?: string;
  respondedAt?: Date;
}

// ============================================================
// DOMÍNIO: EVENTO DO SENSOR (vindo do Flask)
// ============================================================

export type SensorEventType = "INFO" | "ALERTA" | "COMANDO";


export interface SensorLog {
  hora: string;           // "14:23:01"
  tipo: SensorEventType;
  msg: string;            // "🚨 QUEDA DETECTADA: ..."
}

/**
 * Formato que o Flask recebe do ESP32 em POST /api/sensor
 */
export interface SensorPayload {
  deviceId: string;
  chipId?: string;
  timestamp?: string;
  status: string;         // "QUEDA CONFIRMADA", "EM MOVIMENTO", etc.
  accMagnitude: number;   // magnitude da aceleração em m/s²
  checkpoint: number;     // ID sequencial do pacote
  battery: number;
  batteryVoltage: number;
  wifiRssi: number;
}

// ============================================================
// DOMÍNIO: MÉTRICAS DO PAINEL
// ============================================================

export interface DashboardMetrics {
  totalOnline: number;
  inMotion: number;
  falls: number;
}

// ============================================================
// DOMÍNIO: FICHA MÉDICA
// ============================================================

export interface MedicalRecord {
  riskLevel: RiskLevel;
  responsible?: string;   // opcional — nome do médico ou enfermeiro
  observations?: string;  // opcional — campo livre
}

export interface FallRecord {
  date: string;        // "12/05/2025"
  time: string;        // "03:42"
}
