import { SensorFeatures } from '../features/feature_engineering';
import { logger } from '../utils/logger';

export interface TrainingConfig {
  anomalyThreshold: number;
  trainingWindowHours: number;
  minSamples: number;
}

export interface TrainingResult {
  trainedAt: string;
  samplesUsed: number;
  thresholdCalibrated: number;
  featureImportance: Record<string, number>;
}

// Stub : en production, remplacer par un vrai entraînement (Isolation Forest, LSTM, etc.)
export async function trainModel(
  data: SensorFeatures[],
  cfg: TrainingConfig,
): Promise<TrainingResult> {
  logger.info('Démarrage entraînement modèle', { samples: data.length, config: cfg });

  if (data.length < cfg.minSamples) {
    logger.warn('Données insuffisantes pour l\'entraînement', { required: cfg.minSamples, got: data.length });
  }

  // Calibration du seuil par percentile simulé
  const scores = data.map(f => f.fuelNorm * 0.3 + f.tempNorm * 0.4 + f.consumptionRate * 0.3);
  scores.sort((a, b) => a - b);
  const p95Index = Math.floor(scores.length * 0.95);
  const calibrated = scores[p95Index] ?? cfg.anomalyThreshold;

  const result: TrainingResult = {
    trainedAt:           new Date().toISOString(),
    samplesUsed:         data.length,
    thresholdCalibrated: +calibrated.toFixed(4),
    featureImportance:   { tempNorm: 0.40, fuelNorm: 0.30, consumptionRate: 0.20, humidityNorm: 0.10 },
  };

  logger.info('Entraînement terminé', result);
  return result;
}
