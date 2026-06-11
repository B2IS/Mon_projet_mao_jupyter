import { Router } from 'express';
import { CAMERAS_REGISTRY } from '../../../src/data/ingestion';
import { NotFoundError } from '../../../src/utils/exception';

const router = Router();

router.get('/', (req, res) => {
  const { popId, status } = req.query;
  let cameras = [...CAMERAS_REGISTRY];

  if (popId)  cameras = cameras.filter(c => c.popId  === popId);
  if (status) cameras = cameras.filter(c => c.status === status);

  res.json({
    total:       CAMERAS_REGISTRY.length,
    online:      CAMERAS_REGISTRY.filter(c => c.status !== 'offline').length,
    offline:     CAMERAS_REGISTRY.filter(c => c.status === 'offline').length,
    maintenance: 2,
    cameras,
  });
});

router.get('/:id', (req, res, next) => {
  const camera = CAMERAS_REGISTRY.find(c => c.id === req.params.id);
  if (!camera) return next(new NotFoundError('Caméra', req.params.id));
  return res.json(camera);
});

export default router;
