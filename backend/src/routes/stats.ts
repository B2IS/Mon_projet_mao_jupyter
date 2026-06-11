import { Router } from 'express';
import { POPS, CAMERAS_REGISTRY } from '../../../src/data/ingestion';
import { generateNetworkData, generateTimeSeriesData } from '../../../src/data/transformation';

const router = Router();

router.get('/dashboard', (_req, res) => {
  const statusCount = { normal: 0, degraded: 0, critical: 0, offline: 0 };
  POPS.forEach(p => { statusCount[p.status]++; });

  const network = generateNetworkData();

  res.json({
    pops: {
      total:  POPS.length,
      online: POPS.filter(p => p.status !== 'offline').length,
      statusCount,
    },
    cameras: {
      total:       CAMERAS_REGISTRY.length,
      online:      CAMERAS_REGISTRY.filter(c => c.status !== 'offline').length,
      offline:     CAMERAS_REGISTRY.filter(c => c.status === 'offline').length,
      maintenance: 2,
    },
    sensors: { total: 168, online: 168 },
    network: {
      availability: 99.98,
      incoming:     network.incoming,
      outgoing:     network.outgoing,
      history:      network.history,
    },
    alerts: {
      critical: POPS.filter(p => p.status === 'critical').length,
      total:    POPS.filter(p => p.status !== 'normal').length,
    },
    availabilityTrend: generateTimeSeriesData(24, 99.5, 1),
    alertTrend:        generateTimeSeriesData(24, 10, 20),
  });
});

router.get('/energy', (_req, res) => {
  res.json({
    totalConsumption: +(1250 + Math.random() * 200).toFixed(0),
    solarProduction:  +(320  + Math.random() * 50).toFixed(0),
    gridConsumption:  +(930  + Math.random() * 100).toFixed(0),
    generatorHours:   +(45   + Math.random() * 20).toFixed(0),
    avgFuelLevel:     +(65   + Math.random() * 15).toFixed(1),
    popsWithLowFuel:  POPS.filter(p => p.status === 'degraded').length,
    trend:            generateTimeSeriesData(24, 52, 20),
  });
});

export default router;
