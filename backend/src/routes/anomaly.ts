import { Router } from 'express';
import { runInferencePipeline, runInferencePipelineAll } from '../../../src/pipelines/inference_pipeline';
import { runTrainingPipeline } from '../../../src/pipelines/training_pipeline';
import { NotFoundError } from '../../../src/utils/exception';
import { POPS } from '../../../src/data/ingestion';

const router = Router();

// GET /api/anomaly — score all POPs
router.get('/', async (_req, res, next) => {
  try {
    const result = await runInferencePipelineAll();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/anomaly/:popId — score one POP
router.get('/:popId', async (req, res, next) => {
  try {
    const exists = POPS.some(p => p.id === req.params.popId);
    if (!exists) return next(new NotFoundError('POP', req.params.popId));
    const result = await runInferencePipeline(req.params.popId);
    return res.json(result);
  } catch (err) {
    return next(err);
  }
});

// POST /api/anomaly/train — launch training pipeline
router.post('/train', async (req, res, next) => {
  try {
    const { popIds } = req.body as { popIds?: string[] };
    const result = await runTrainingPipeline(popIds);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
