import { fetchSensorReading, POPS } from '../data/ingestion';
import { filterValidReadings } from '../data/validation';
import { extractFeaturesBatch } from '../features/feature_engineering';
import { trainModel, TrainingConfig, TrainingResult } from '../models/train';
import { PipelineResult, SensorReading } from '../entity/config_entity';
import { config } from '../config/config';
import { logger } from '../utils/logger';

export async function runTrainingPipeline(
  popIds?: string[],
  overrides?: Partial<TrainingConfig>,
): Promise<PipelineResult<TrainingResult>> {
  const start = Date.now();

  const targets = popIds?.length
    ? POPS.filter(p => popIds.includes(p.id))
    : POPS;

  logger.info('Démarrage pipeline entraînement', { pops: targets.length });

  // Ingestion : simulation de plusieurs lectures par POP
  const raw: SensorReading[] = targets.flatMap(pop =>
    Array.from({ length: 10 }, () => fetchSensorReading(pop.id))
  );

  // Validation
  const { valid, rejected } = filterValidReadings(raw);
  logger.info('Validation terminée', { total: raw.length, valid: valid.length, rejected });

  if (valid.length === 0) {
    return {
      success: false,
      errors: ['Aucune lecture valide pour l\'entraînement'],
      processedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
    };
  }

  // Feature engineering
  const features = extractFeaturesBatch(valid);

  // Entraînement
  const cfg: TrainingConfig = {
    anomalyThreshold:    config.ml.anomalyThreshold,
    trainingWindowHours: config.ml.trainingWindowHours,
    minSamples:          50,
    ...overrides,
  };

  const result = await trainModel(features, cfg);

  return {
    success:     true,
    data:        result,
    errors:      [],
    processedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
  };
}
