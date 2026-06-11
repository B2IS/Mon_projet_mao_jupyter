// ── POP (Point of Présence) ───────────────────────────────────────────────────

export type POPStatus = 'normal' | 'degraded' | 'critical' | 'offline';

export interface POP {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
  status: POPStatus;
  cameras: number;
  sensors: number;
  address: string;
}

// ── Capteurs IoT ──────────────────────────────────────────────────────────────

export interface SensorReading {
  popId: string;
  temperature: number;        // °C
  humidity: number;           // %
  fuelLevel: number;          // %
  fuelCapacity: number;       // litres
  fuelConsumption: number;    // L/h
  airQuality: 'Bonne' | 'Modérée' | 'Mauvaise';
  smokeDetected: boolean;
  doorOpen: boolean;
  presence: boolean;
  powerSource: string;
  timestamp: string;
}

export interface SensorValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

// ── Caméras ───────────────────────────────────────────────────────────────────

export type CameraStatus = 'live' | 'alert' | 'offline';

export interface Camera {
  id: string;
  popId: string;
  popName: string;
  name: string;
  type: 'PTZ' | 'Fixe';
  status: CameraStatus;
  rtspUrl: string;
  hlsUrl: string;
  resolution: string;
  fps: number;
  alertType: string | null;
}

// ── Événements & Incidents ────────────────────────────────────────────────────

export type EventSeverity = 'critical' | 'major' | 'minor' | 'info';
export type EventStatus = 'new' | 'in_progress' | 'resolved' | 'escalated';

export interface POPEvent {
  id: string;
  time: string;
  popId: string;
  popName: string;
  type: string;
  zone: string;
  severity: EventSeverity;
  status: EventStatus;
  assignedTo?: string;
  description: string;
  cameraId?: string;
}

// ── Réseau ────────────────────────────────────────────────────────────────────

export interface NetworkSnapshot {
  incoming: number;   // Mbps
  outgoing: number;   // Mbps
  history: Array<{ t: number; in: number; out: number }>;
}

// ── Séries temporelles ────────────────────────────────────────────────────────

export interface TimeSeriesPoint {
  time: string;
  value: number;
}

// ── Santé POP ─────────────────────────────────────────────────────────────────

export interface POPHealthScore {
  overall: number;       // 0-100
  energie: number;
  environment: number;
  security: number;
  network: number;
}

// ── Anomalie détectée ─────────────────────────────────────────────────────────

export interface AnomalyResult {
  popId: string;
  detected: boolean;
  score: number;          // 0-1 (confidence)
  metric: string;
  value: number;
  threshold: number;
  severity: EventSeverity;
  message: string;
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

export interface PipelineResult<T> {
  success: boolean;
  data?: T;
  errors: string[];
  processedAt: string;
  durationMs: number;
}
