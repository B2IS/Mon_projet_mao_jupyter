import { Router } from 'express';
import { generateEvent } from '../../../src/data/ingestion';
import { POPEvent } from '../../../src/entity/config_entity';
import { NotFoundError } from '../../../src/utils/exception';

const router = Router();

const INCIDENTS: POPEvent[] = Array.from({ length: 52 }, () => generateEvent());

Object.assign(INCIDENTS[0], { time: '14:21:30', popName: 'POP Thiès',    type: 'Intrusion détectée',         severity: 'critical', status: 'new',         zone: 'Entrée principale', description: "Détection d'un intrus dans la zone d'entrée principale du site." });
Object.assign(INCIDENTS[1], { time: '14:18:45', popName: 'POP Kaolack',  type: 'Détection de fumée',         severity: 'critical', status: 'in_progress', zone: 'Salle énergie',      assignedTo: 'A. Diop' });
Object.assign(INCIDENTS[2], { time: '14:15:02', popName: 'POP Louga',    type: 'Température élevée',         severity: 'major',    status: 'in_progress', zone: 'Salle télécom',      assignedTo: 'M. Fall' });
Object.assign(INCIDENTS[3], { time: '14:12:09', popName: 'POP Matam',    type: 'Niveau gasoil faible (18%)', severity: 'major',    status: 'in_progress', zone: 'Groupe électrogène', assignedTo: 'I. Ndiaye' });
Object.assign(INCIDENTS[4], { time: '14:08:09', popName: 'POP Podor',    type: 'Caméra hors ligne',          severity: 'minor',    status: 'new',         zone: 'Caméra extérieure' });
Object.assign(INCIDENTS[5], { time: '14:05:44', popName: 'POP Ziguinchor', type: 'Porte ouverte',            severity: 'minor',    status: 'resolved',    zone: 'Salle énergie',      assignedTo: 'B. Sarr' });

router.get('/', (req, res) => {
  const { severity, status, page = '1', limit = '8' } = req.query;
  let incidents = [...INCIDENTS];

  if (severity) incidents = incidents.filter(i => i.severity === severity);
  if (status)   incidents = incidents.filter(i => i.status   === status);

  const total    = incidents.length;
  const start    = (Number(page) - 1) * Number(limit);
  const paginated = incidents.slice(start, start + Number(limit));

  const typeCounts: Record<string, number> = {};
  INCIDENTS.forEach(i => {
    const key = i.type.split(' ')[0];
    typeCounts[key] = (typeCounts[key] || 0) + 1;
  });

  const statusCounts = {
    new:         INCIDENTS.filter(i => i.status === 'new').length,
    in_progress: INCIDENTS.filter(i => i.status === 'in_progress').length,
    escalated:   INCIDENTS.filter(i => i.status === 'escalated').length,
    resolved:    INCIDENTS.filter(i => i.status === 'resolved').length,
  };

  res.json({ incidents: paginated, total, totalPages: Math.ceil(total / Number(limit)), typeCounts, statusCounts });
});

router.get('/:id', (req, res, next) => {
  const incident = INCIDENTS.find(i => i.id === req.params.id);
  if (!incident) return next(new NotFoundError('Incident', req.params.id));
  return res.json(incident);
});

router.patch('/:id', (req, res, next) => {
  const idx = INCIDENTS.findIndex(i => i.id === req.params.id);
  if (idx === -1) return next(new NotFoundError('Incident', req.params.id));
  INCIDENTS[idx] = { ...INCIDENTS[idx], ...req.body };
  return res.json(INCIDENTS[idx]);
});

export default router;
