import { Router } from 'express';
import { generateEvent } from '../../../src/data/ingestion';
import { POPEvent } from '../../../src/entity/config_entity';

const router = Router();

const BASE_EVENTS: POPEvent[] = Array.from({ length: 52 }, () => generateEvent());

// Inject predictable critical events at the top
Object.assign(BASE_EVENTS[0], { time: '14:21:30', popName: 'POP Thiès',    type: 'Intrusion détectée',        severity: 'critical', status: 'new',         zone: 'Entrée principale' });
Object.assign(BASE_EVENTS[1], { time: '14:18:45', popName: 'POP Kaolack',  type: 'Détection de fumée',        severity: 'critical', status: 'in_progress', zone: 'Salle énergie' });
Object.assign(BASE_EVENTS[2], { time: '14:15:02', popName: 'POP Louga',    type: 'Température élevée',        severity: 'major',    status: 'in_progress', zone: 'Salle télécom',         assignedTo: 'M. Fall' });
Object.assign(BASE_EVENTS[3], { time: '14:12:09', popName: 'POP Matam',    type: 'Niveau gasoil faible (18%)', severity: 'major',   status: 'in_progress', zone: 'Groupe électrogène',    assignedTo: 'I. Ndiaye' });
Object.assign(BASE_EVENTS[4], { time: '14:08:09', popName: 'POP Podor',    type: 'Caméra hors ligne',         severity: 'minor',    status: 'new',         zone: 'Caméra extérieure' });
Object.assign(BASE_EVENTS[5], { time: '14:05:44', popName: 'POP Ziguinchor', type: 'Porte ouverte',           severity: 'minor',    status: 'resolved',    zone: 'Salle énergie',         assignedTo: 'B. Sarr' });
Object.assign(BASE_EVENTS[6], { time: '13:58:31', popName: 'POP Kolda',    type: 'Vibrations anormales',      severity: 'info',     status: 'in_progress', zone: 'Salle serveurs' });
Object.assign(BASE_EVENTS[7], { time: '13:52:17', popName: 'POP Saint-Louis', type: "Qualité d'air dégradée",severity: 'info',     status: 'in_progress', zone: 'Salle énergie' });

router.get('/', (req, res) => {
  const { severity, status, limit = '50', offset = '0' } = req.query;
  let events = [...BASE_EVENTS];

  if (severity) events = events.filter(e => e.severity === severity);
  if (status)   events = events.filter(e => e.status   === status);

  const total  = events.length;
  const paged  = events.slice(Number(offset), Number(offset) + Number(limit));

  const counts = {
    critical: BASE_EVENTS.filter(e => e.severity === 'critical').length,
    major:    BASE_EVENTS.filter(e => e.severity === 'major').length,
    minor:    BASE_EVENTS.filter(e => e.severity === 'minor').length,
    info:     BASE_EVENTS.filter(e => e.severity === 'info').length,
    total:    BASE_EVENTS.length,
  };

  res.json({ events: paged, total, counts });
});

router.get('/recent', (_req, res) => {
  res.json(BASE_EVENTS.slice(0, 8));
});

export default router;
