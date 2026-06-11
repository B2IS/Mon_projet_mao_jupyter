import { Router } from 'express';
import { POPS, CAMERAS_REGISTRY, fetchSensorReading } from '../../../src/data/ingestion';
import { generateTimeSeriesData } from '../../../src/data/transformation';
import { NotFoundError } from '../../../src/utils/exception';

const router = Router();

router.get('/', (_req, res) => {
  const statusCount = { normal: 0, degraded: 0, critical: 0, offline: 0 };
  POPS.forEach(p => { statusCount[p.status]++; });
  res.json({
    total:   POPS.length,
    online:  POPS.filter(p => p.status !== 'offline').length,
    statusCount,
    pops:    POPS,
  });
});

router.get('/:id', (req, res, next) => {
  const pop = POPS.find(p => p.id === req.params.id);
  if (!pop) return next(new NotFoundError('POP', req.params.id));

  const sensors = fetchSensorReading(pop.id);
  const cameras = CAMERAS_REGISTRY.filter(c => c.popId === pop.id);

  const equipment = [
    { name: 'Routeurs',              status: 'ok' },
    { name: 'Switch Core',           status: 'ok' },
    { name: 'UPS',                   status: pop.status === 'degraded' ? 'warning' : 'ok' },
    { name: 'Groupe électrogène',    status: pop.status === 'critical' ? 'error'   : 'ok' },
    { name: 'Climatisations',        status: 'ok' },
    { name: 'Détecteur fumée',       status: 'ok' },
    { name: "Détecteur d'ouverture", status: 'ok' },
  ];

  const healthScore =
    pop.status === 'normal'   ? 94 + Math.floor(Math.random() * 6) :
    pop.status === 'degraded' ? 70 + Math.floor(Math.random() * 15) :
                                40 + Math.floor(Math.random() * 20);

  return res.json({
    ...pop,
    sensors,
    cameras,
    equipment,
    healthScore,
    health: {
      energie:     pop.status === 'normal' ? 100 : pop.status === 'degraded' ? 85 : 60,
      environment: 93,
      security:    pop.status === 'critical' ? 40 : pop.status === 'degraded' ? 75 : 98,
      network:     pop.status === 'offline'  ? 0  : 96,
    },
    charts: {
      temperature: generateTimeSeriesData(24, sensors.temperature, 4),
      humidity:    generateTimeSeriesData(24, sensors.humidity, 10),
      energy:      generateTimeSeriesData(24, 35, 15),
    },
  });
});

export default router;
