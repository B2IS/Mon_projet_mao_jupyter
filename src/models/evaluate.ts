import { AnomalyResult } from '../entity/config_entity';

export interface EvaluationMetrics {
  accuracy:  number;
  precision: number;
  recall:    number;
  f1Score:   number;
  truePositives:  number;
  falsePositives: number;
  falseNegatives: number;
  trueNegatives:  number;
}

export function evaluateModel(
  predictions: AnomalyResult[],
  groundTruth: boolean[],
): EvaluationMetrics {
  if (predictions.length !== groundTruth.length) {
    throw new Error('predictions and groundTruth must have the same length');
  }

  let tp = 0, fp = 0, fn = 0, tn = 0;

  for (let i = 0; i < predictions.length; i++) {
    const predicted = predictions[i].detected;
    const actual    = groundTruth[i];
    if (predicted && actual)   tp++;
    else if (predicted && !actual) fp++;
    else if (!predicted && actual) fn++;
    else                           tn++;
  }

  const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
  const recall    = tp + fn > 0 ? tp / (tp + fn) : 0;
  const f1Score   = precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0;
  const accuracy  = predictions.length > 0 ? (tp + tn) / predictions.length : 0;

  return {
    accuracy:        +accuracy.toFixed(4),
    precision:       +precision.toFixed(4),
    recall:          +recall.toFixed(4),
    f1Score:         +f1Score.toFixed(4),
    truePositives:   tp,
    falsePositives:  fp,
    falseNegatives:  fn,
    trueNegatives:   tn,
  };
}
