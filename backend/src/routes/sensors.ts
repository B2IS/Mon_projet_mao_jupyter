import { Router } from 'express';
import { POPS, fetchSensorReading } from '../../../src/data/ingestion';
import { NotFoundError } from '../../../src/utils/exception';

const router = Router();

router.get('/', (_req, res) => {
  const sensors = POPS.map(pop => ({
    popId:   pop.id,
    popName: pop.name,
    ...fetchSensorReading(pop.id),
  }));
  res.json({ total: POPS.length * 6, online: POPS.length * 6, sensors });
});

router.get('/:popId', (req, res, next) => {
  const pop = POPS.find(p => p.id === req.params.popId);
  if (!pop) return next(new NotFoundError('POP', req.params.popId));
  return res.json(fetchSensorReading(pop.id));
});

export default router;
