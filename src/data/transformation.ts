// ── Transformation & normalisation des données ────────────────────────────────
// Convertit les lectures brutes en structures prêtes pour l'API et les modèles.

import { SensorReading, TimeSeriesPoint, NetworkSnapshot } from '../entity/config_entity';

// ── Séries temporelles ────────────────────────────────────────────────────────

export function generateTimeSeriesData(
  hours: number,
  baseValue: number,
  variance: number,
): TimeSeriesPoint[] {
  const now = new Date();
  return Array.from({ length: hours + 1 }, (_, i) => {
    const t = new Date(now.getTime() - (hours - i) * 3_600_000);
    return {
      time: `${String(t.getHours()).padStart(2, '0')}:00`,
      value: +(baseValue + (Math.random() - 0.5) * variance).toFixed(1),
    };
  });
}

// ── Réseau ────────────────────────────────────────────────────────────────────

export function generateNetworkData(): NetworkSnapshot {
  return {
    incoming: +(290 + Math.random() * 40).toFixed(0),
    outgoing: +(170 + Math.random() * 30).toFixed(0),
    history: Array.from({ length: 20 }, (_, i) => ({
      t: i,
      in: +(280 + Math.random() * 60),
      out: +(160 + Math.random() * 50),
    })),
  };
}

// ── Normalisation min-max ─────────────────────────────────────────────────────

export function normalizeMinMax(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

// ── Lissage exponentiel (EMA) ─────────────────────────────────────────────────

export function exponentialMovingAverage(series: number[], alpha = 0.3): number[] {
  if (series.length === 0) return [];
  const ema = [series[0]];
  for (let i = 1; i < series.length; i++) {
    ema.push(alpha * series[i] + (1 - alpha) * ema[i - 1]);
  }
  return ema;
}

// ── Agrégation par heure ──────────────────────────────────────────────────────

export interface HourlyAggregate {
  hour: string;
  avg: number;
  min: number;
  max: number;
  count: number;
}

export function aggregateByHour(
  readings: Array<{ timestamp: string; value: number }>,
): HourlyAggregate[] {
  const buckets = new Map<string, number[]>();

  for (const r of readings) {
    const hour = new Date(r.timestamp).toISOString().slice(0, 13);
    const bucket = buckets.get(hour) ?? [];
    bucket.push(r.value);
    buckets.set(hour, bucket);
  }

  return Array.from(buckets.entries()).map(([hour, values]) => ({
    hour,
    avg: +(values.reduce((a, b) => a + b, 0) / values.length).toFixed(2),
    min: Math.min(...values),
    max: Math.max(...values),
    count: values.length,
  }));
}

// ── Extraction des KPIs d'une lecture ────────────────────────────────────────

export function extractKPIs(reading: SensorReading) {
  const fuelAutonomy = reading.fuelConsumption > 0
    ? +(reading.fuelLevel / 100 * reading.fuelCapacity / reading.fuelConsumption).toFixed(1)
    : null;

  return {
    popId: reading.popId,
    timestamp: reading.timestamp,
    kpis: {
      temperature: reading.temperature,
      humidity: reading.humidity,
      fuelAutonomyHours: fuelAutonomy,
      fuelLevelPercent: reading.fuelLevel,
      powerSource: reading.powerSource,
      alertFlags: {
        smoke: reading.smokeDetected,
        door: reading.doorOpen,
        presence: reading.presence,
      },
    },
  };
}
