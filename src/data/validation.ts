// ── Validation des données brutes ─────────────────────────────────────────────
// Vérifie la cohérence des lectures avant de les envoyer au pipeline.

import { SensorReading, SensorValidationResult, Camera } from '../entity/config_entity';
import { logger } from '../utils/logger';

// Plages physiologiques acceptables pour chaque métrique
const SENSOR_BOUNDS = {
  temperature:     { min: -10,  max: 60  },   // °C
  humidity:        { min: 0,    max: 100 },   // %
  fuelLevel:       { min: 0,    max: 100 },   // %
  fuelConsumption: { min: 0,    max: 100 },   // L/h
};

// Seuils d'alerte (non bloquants — génèrent des warnings)
const ALERT_THRESHOLDS = {
  temperature:     { high: 45,  low: 5   },
  humidity:        { high: 85,  low: 10  },
  fuelLevel:       { low: 20   },
  fuelConsumption: { high: 50  },
};

export function validateSensorReading(reading: SensorReading): SensorValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Bounds checks
  for (const [key, bounds] of Object.entries(SENSOR_BOUNDS)) {
    const value = reading[key as keyof typeof SENSOR_BOUNDS] as number;
    if (value < bounds.min || value > bounds.max) {
      errors.push(`${key} hors limites : ${value} (attendu [${bounds.min}, ${bounds.max}])`);
    }
  }

  // Timestamp freshness: reject readings older than 5 min
  const ageMs = Date.now() - new Date(reading.timestamp).getTime();
  if (ageMs > 5 * 60 * 1000) {
    warnings.push(`Lecture obsolète : ${Math.round(ageMs / 1000)}s`);
  }

  // Alert threshold warnings
  const t = ALERT_THRESHOLDS;
  if (reading.temperature > t.temperature.high)
    warnings.push(`Température élevée : ${reading.temperature}°C`);
  if (reading.temperature < t.temperature.low)
    warnings.push(`Température basse : ${reading.temperature}°C`);
  if (reading.humidity > t.humidity.high)
    warnings.push(`Humidité élevée : ${reading.humidity}%`);
  if (reading.fuelLevel < t.fuelLevel.low)
    warnings.push(`Niveau carburant critique : ${reading.fuelLevel}%`);
  if (reading.fuelConsumption > t.fuelConsumption.high)
    warnings.push(`Consommation carburant anormale : ${reading.fuelConsumption} L/h`);

  if (reading.smokeDetected) warnings.push('Fumée détectée');
  if (reading.doorOpen)      warnings.push('Porte ouverte');

  const valid = errors.length === 0;
  if (!valid) logger.warn('Lecture capteur invalide', { popId: reading.popId, errors });

  return { valid, errors, warnings };
}

export function validateCameraStatus(camera: Camera): boolean {
  if (!camera.rtspUrl.startsWith('rtsp://') && !camera.rtspUrl.startsWith('onvif://')) {
    logger.warn('URL caméra invalide', { id: camera.id, url: camera.rtspUrl });
    return false;
  }
  return true;
}

export function filterValidReadings(
  readings: SensorReading[],
): { valid: SensorReading[]; rejected: number } {
  const valid: SensorReading[] = [];
  let rejected = 0;

  for (const r of readings) {
    const result = validateSensorReading(r);
    if (result.valid) {
      valid.push(r);
    } else {
      rejected++;
    }
  }

  logger.info('Validation terminée', { total: readings.length, valid: valid.length, rejected });
  return { valid, rejected };
}
