import { SensorFeatures } from '../features/feature_engineering';
import { AnomalyResult, EventSeverity } from '../entity/config_entity';
import { config } from '../config/config';

interface Rule {
  name: string;
  check: (f: SensorFeatures) => boolean;
  score: number;
  severity: EventSeverity;
  message: (f: SensorFeatures) => string;
}

const RULES: Rule[] = [
  {
    name: 'smoke',
    check: f => (f.binaryFlags & 0b001) !== 0,
    score: 0.98,
    severity: 'critical',
    message: f => `Fumée détectée sur ${f.popId}`,
  },
  {
    name: 'fuel_critical',
    check: f => f.fuelNorm < 0.15,
    score: 0.92,
    severity: 'critical',
    message: f => `Carburant critique : ${(f.fuelNorm * 100).toFixed(0)}% sur ${f.popId}`,
  },
  {
    name: 'overheating',
    check: f => f.tempNorm > 0.9,
    score: 0.90,
    severity: 'critical',
    message: f => `Température critique sur ${f.popId}`,
  },
  {
    name: 'fuel_low',
    check: f => f.fuelNorm >= 0.15 && f.fuelNorm < 0.25,
    score: 0.78,
    severity: 'major',
    message: f => `Niveau carburant faible : ${(f.fuelNorm * 100).toFixed(0)}% sur ${f.popId}`,
  },
  {
    name: 'high_temp',
    check: f => f.tempNorm > 0.75 && f.tempNorm <= 0.9,
    score: 0.72,
    severity: 'major',
    message: f => `Température élevée sur ${f.popId}`,
  },
  {
    name: 'intrusion',
    check: f => (f.binaryFlags & 0b110) === 0b110,
    score: 0.88,
    severity: 'major',
    message: f => `Présence + porte ouverte sur ${f.popId}`,
  },
  {
    name: 'door_open',
    check: f => (f.binaryFlags & 0b010) !== 0,
    score: 0.55,
    severity: 'minor',
    message: f => `Porte ouverte sur ${f.popId}`,
  },
  {
    name: 'grid_loss',
    check: f => f.powerScore < 1.0,
    score: 0.60,
    severity: 'minor',
    message: f => `Fonctionnement sur groupe seul sur ${f.popId}`,
  },
];

export function scoreAnomaly(features: SensorFeatures): AnomalyResult {
  const threshold = config.ml.anomalyThreshold;
  let best: Rule | null = null;

  for (const rule of RULES) {
    if (rule.check(features) && rule.score > threshold) {
      if (!best || rule.score > best.score) best = rule;
    }
  }

  if (!best) {
    return {
      popId:     features.popId,
      detected:  false,
      score:     0,
      metric:    'none',
      value:     0,
      threshold,
      severity:  'info',
      message:   'Aucune anomalie détectée',
    };
  }

  return {
    popId:     features.popId,
    detected:  true,
    score:     best.score,
    metric:    best.name,
    value:     best.score,
    threshold,
    severity:  best.severity,
    message:   best.message(features),
  };
}

export function scoreAnomalyBatch(featuresBatch: SensorFeatures[]): AnomalyResult[] {
  return featuresBatch.map(scoreAnomaly);
}
