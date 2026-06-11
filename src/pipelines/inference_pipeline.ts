import { fetchSensorReading, POPS } from '../data/ingestion';
import { validateSensorReading } from '../data/validation';
import { extractFeatures } from '../features/feature_engineering';
import { scoreAnomaly } from '../models/predict';
import { AnomalyResult, PipelineResult } from '../entity/config_entity';
import { logger } from '../utils/logger';

export async function runInferencePipeline(popId: string): Promise<PipelineResult<AnomalyResult>> {
  const start = Date.now();
  const errors: string[] = [];

  const pop = POPS.find(p => p.id === popId);
  if (!pop) {
    return { success: false, errors: [`POP inconnu : ${popId}`], processedAt: new Date().toISOString(), durationMs: 0 };
  }

  const reading = fetchSensorReading(popId);
  const validation = validateSensorReading(reading);

  if (!validation.valid) {
    errors.push(...validation.errors);
    logger.warn('Lecture invalide ignorée par le pipeline', { popId, errors });
    return { success: false, errors, processedAt: new Date().toISOString(), durationMs: Date.now() - start };
  }

  const features = extractFeatures(reading);
  const result   = scoreAnomaly(features);

  if (result.detected) {
    logger.warn('Anomalie détectée', { popId, score: result.score, metric: result.metric });
  }

  return {
    success:     true,
    data:        result,
    errors:      [],
    processedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
  };
}

export async function runInferencePipelineAll(): Promise<PipelineResult<AnomalyResult[]>> {
  const start = Date.now();
  const results: AnomalyResult[] = [];
  const errors: string[] = [];

  for (const pop of POPS) {
    const r = await runInferencePipeline(pop.id);
    if (r.success && r.data) results.push(r.data);
    else errors.push(...r.errors);
  }

  logger.info('Pipeline inférence terminé', { total: POPS.length, anomalies: results.filter(r => r.detected).length });

  return {
    success:     errors.length === 0,
    data:        results,
    errors,
    processedAt: new Date().toISOString(),
    durationMs:  Date.now() - start,
  };
}
