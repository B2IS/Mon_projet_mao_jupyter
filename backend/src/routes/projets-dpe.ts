import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

export type StatutProjet = 'planifie' | 'en_cours' | 'suspendu' | 'receptionnee' | 'cloture';
export type DomaineProjet = 'electrification' | 'solaire' | 'hydraulique' | 'telecom' | 'BTP' | 'autre';
export type GraviteIncident = 'faible' | 'modere' | 'grave' | 'bloquant';

interface IncidentProjet {
  id: string;
  type: 'retard' | 'technique' | 'securite' | 'administratif' | 'autre';
  gravite: GraviteIncident;
  description: string;
  actionCorrective: string;
  date: string;
  statut: 'ouvert' | 'en_cours' | 'resolu';
}

interface AvancementHebdo {
  id: string;
  semaine: string;
  avancement: number;
  commentaire: string;
  auteur: string;
  date: string;
}

interface ProjetDPE {
  id: string;
  code: string;
  intitule: string;
  description: string;
  chefProjet: string;
  direction: string;
  domaine: DomaineProjet;
  statut: StatutProjet;
  priorite: 'critique' | 'haute' | 'normale' | 'faible';
  dateDebut: string;
  dateFin: string;
  avancement: number;
  dateMAJ: string;
  localite: string;
  region: string;
  lat: number;
  lng: number;
  budget: number;
  budgetConsomme: number;
  entreprise: string;
  nbLocalites?: number;
  incidents: IncidentProjet[];
  avancements: AvancementHebdo[];
}

const PROJETS_DPE: ProjetDPE[] = [
  {
    id: 'p1', code: 'DPE-2026-001', intitule: 'Électrification rurale — Kaolack Sud',
    description: 'Électrification de 18 localités rurales dans la zone de Kaolack Sud via extension réseau MT/BT.',
    chefProjet: 'M. Abdou Fall', direction: 'DER', domaine: 'electrification',
    statut: 'en_cours', priorite: 'critique', dateDebut: '2026-01-15', dateFin: '2026-09-30',
    avancement: 62, dateMAJ: '2026-05-20', localite: 'Kaolack', region: 'Kaolack',
    lat: 14.1536, lng: -16.0726, budget: 450000000, budgetConsomme: 285000000,
    entreprise: 'ELEC Sénégal SARL', nbLocalites: 18,
    incidents: [
      { id: 'i1', type: 'retard', gravite: 'modere', description: 'Livraison pylônes retardée de 3 semaines', actionCorrective: 'Commande accélérée auprès fournisseur alternatif', date: '2026-04-10', statut: 'en_cours' },
      { id: 'i2', type: 'administratif', gravite: 'faible', description: 'DUP non signée pour 2 villages', actionCorrective: 'Réunion avec chefs de villages planifiée', date: '2026-03-22', statut: 'resolu' },
    ],
    avancements: [
      { id: 'a1', semaine: 'S19', avancement: 55, commentaire: 'Pose de 60% des pylônes BT effectuée', auteur: 'M. Fall', date: '2026-05-12' },
      { id: 'a2', semaine: 'S20', avancement: 62, commentaire: 'Raccordement 8 localités terminé', auteur: 'M. Fall', date: '2026-05-19' },
    ],
  },
  {
    id: 'p2', code: 'DPE-2026-002', intitule: 'Centrale solaire hybride — Podor',
    description: 'Installation d\'une centrale solaire hybride 500 kWc avec stockage batterie pour 12 villages.',
    chefProjet: 'Mme Fatou Diallo', direction: 'DERD', domaine: 'solaire',
    statut: 'en_cours', priorite: 'haute', dateDebut: '2026-02-01', dateFin: '2026-11-30',
    avancement: 38, dateMAJ: '2026-05-18', localite: 'Podor', region: 'Saint-Louis',
    lat: 16.6520, lng: -14.9620, budget: 780000000, budgetConsomme: 195000000,
    entreprise: 'SolarTech Africa', nbLocalites: 12,
    incidents: [
      { id: 'i3', type: 'technique', gravite: 'grave', description: 'Défaut d\'isolation sur 40 panneaux du lot 1', actionCorrective: 'Remplacement en cours par fournisseur sous garantie', date: '2026-05-05', statut: 'en_cours' },
    ],
    avancements: [
      { id: 'a3', semaine: 'S18', avancement: 30, commentaire: 'Terrassement site + fondations structures terminés', auteur: 'F. Diallo', date: '2026-05-05' },
      { id: 'a4', semaine: 'S20', avancement: 38, commentaire: 'Montage 180 panneaux sur 450 prévus', auteur: 'F. Diallo', date: '2026-05-19' },
    ],
  },
  {
    id: 'p3', code: 'DPE-2026-003', intitule: 'Réseau eau potable — Matam',
    description: 'Extension du réseau d\'adduction d\'eau potable sur 45 km pour 8 communes rurales.',
    chefProjet: 'M. Ibrahima Ndiaye', direction: 'DGPH', domaine: 'hydraulique',
    statut: 'receptionnee', priorite: 'haute', dateDebut: '2025-07-01', dateFin: '2026-04-30',
    avancement: 100, dateMAJ: '2026-04-28', localite: 'Matam', region: 'Matam',
    lat: 15.6600, lng: -13.2540, budget: 320000000, budgetConsomme: 315000000,
    entreprise: 'Hydraulique Plus SA', nbLocalites: 8,
    incidents: [],
    avancements: [
      { id: 'a5', semaine: 'S17', avancement: 98, commentaire: 'Tests pression finaux en cours', auteur: 'I. Ndiaye', date: '2026-04-22' },
      { id: 'a6', semaine: 'S18', avancement: 100, commentaire: 'Réception provisoire signée', auteur: 'I. Ndiaye', date: '2026-04-28' },
    ],
  },
  {
    id: 'p4', code: 'DPE-2026-004', intitule: 'Fibre optique rurale — Ziguinchor',
    description: 'Déploiement de 120 km de fibre optique pour connecter 25 localités en Casamance.',
    chefProjet: 'M. Bassirou Sarr', direction: 'DIT', domaine: 'telecom',
    statut: 'en_cours', priorite: 'haute', dateDebut: '2026-03-01', dateFin: '2026-12-31',
    avancement: 22, dateMAJ: '2026-05-21', localite: 'Ziguinchor', region: 'Ziguinchor',
    lat: 12.5600, lng: -16.2710, budget: 560000000, budgetConsomme: 98000000,
    entreprise: 'ConnectAfrique SAS', nbLocalites: 25,
    incidents: [
      { id: 'i4', type: 'securite', gravite: 'modere', description: 'Accès difficile dans 3 zones forestières', actionCorrective: 'Négociation accès avec autorités locales', date: '2026-04-15', statut: 'resolu' },
      { id: 'i5', type: 'administratif', gravite: 'bloquant', description: 'Autorisation traversée RN4 non délivrée', actionCorrective: 'Dossier déposé auprès AGEROUTE', date: '2026-05-10', statut: 'ouvert' },
    ],
    avancements: [
      { id: 'a7', semaine: 'S19', avancement: 18, commentaire: 'Pose 22 km sur 120 km prévus', auteur: 'B. Sarr', date: '2026-05-12' },
      { id: 'a8', semaine: 'S20', avancement: 22, commentaire: 'Tirage câble segment Ziguinchor–Oussouye finalisé', auteur: 'B. Sarr', date: '2026-05-19' },
    ],
  },
  {
    id: 'p5', code: 'DPE-2026-005', intitule: 'Construction piste rurale — Louga',
    description: 'Construction de 35 km de piste en latérite reliant 6 villages enclavés au réseau routier.',
    chefProjet: 'Mme Aminata Diop', direction: 'DTPR', domaine: 'BTP',
    statut: 'planifie', priorite: 'normale', dateDebut: '2026-06-01', dateFin: '2026-12-15',
    avancement: 0, dateMAJ: '2026-05-15', localite: 'Louga', region: 'Louga',
    lat: 15.6177, lng: -16.2273, budget: 210000000, budgetConsomme: 0,
    entreprise: 'BTP Afrique SARL', nbLocalites: 6,
    incidents: [],
    avancements: [],
  },
  {
    id: 'p6', code: 'DPE-2026-006', intitule: 'Électrification solaire — Thiès Rural',
    description: 'Mini-réseaux solaires pour 15 villages hors réseau dans le département de Mbour.',
    chefProjet: 'M. Cheikh Mbaye', direction: 'DER', domaine: 'solaire',
    statut: 'en_cours', priorite: 'critique', dateDebut: '2026-01-10', dateFin: '2026-08-31',
    avancement: 78, dateMAJ: '2026-05-22', localite: 'Thiès', region: 'Thiès',
    lat: 14.7897, lng: -16.9327, budget: 385000000, budgetConsomme: 302000000,
    entreprise: 'SunPower Sénégal', nbLocalites: 15,
    incidents: [],
    avancements: [
      { id: 'a9', semaine: 'S19', avancement: 72, commentaire: '11 mini-réseaux opérationnels sur 15', auteur: 'C. Mbaye', date: '2026-05-12' },
      { id: 'a10', semaine: 'S20', avancement: 78, commentaire: '12 mini-réseaux opérationnels, 3 en cours de câblage', auteur: 'C. Mbaye', date: '2026-05-19' },
    ],
  },
  {
    id: 'p7', code: 'DPE-2026-007', intitule: 'Réseau MT/BT — Tambacounda Est',
    description: 'Extension réseau MT/BT 90 km pour électrifier 22 villages le long de la RN1.',
    chefProjet: 'M. Ousmane Kouyaté', direction: 'DER', domaine: 'electrification',
    statut: 'suspendu', priorite: 'haute', dateDebut: '2026-02-15', dateFin: '2026-10-31',
    avancement: 15, dateMAJ: '2026-04-30', localite: 'Tambacounda', region: 'Tambacounda',
    lat: 13.7700, lng: -13.6600, budget: 620000000, budgetConsomme: 89000000,
    entreprise: 'Elec-Build SARL', nbLocalites: 22,
    incidents: [
      { id: 'i6', type: 'administratif', gravite: 'bloquant', description: 'Litige foncier sur emprise ligne à Koumpentoum', actionCorrective: 'Dossier en cours de traitement juridique', date: '2026-04-20', statut: 'ouvert' },
    ],
    avancements: [
      { id: 'a11', semaine: 'S14', avancement: 15, commentaire: 'Travaux suspendus — litige foncier', auteur: 'O. Kouyaté', date: '2026-04-07' },
    ],
  },
  {
    id: 'p8', code: 'DPE-2026-008', intitule: 'Forage + château d\'eau — Kédougou',
    description: 'Construction de 4 forages équipés + 2 châteaux d\'eau de 100 m³ pour 10 000 habitants.',
    chefProjet: 'M. Lamine Badji', direction: 'DGPH', domaine: 'hydraulique',
    statut: 'en_cours', priorite: 'critique', dateDebut: '2026-01-20', dateFin: '2026-07-31',
    avancement: 55, dateMAJ: '2026-05-20', localite: 'Kédougou', region: 'Kédougou',
    lat: 12.5549, lng: -12.1778, budget: 290000000, budgetConsomme: 158000000,
    entreprise: 'Forage & Génie SARL', nbLocalites: 5,
    incidents: [
      { id: 'i7', type: 'technique', gravite: 'modere', description: 'Forage n°2 : formation rocheuse imprévue à -45m', actionCorrective: 'Mobilisation foreuse rotary spécialisée', date: '2026-04-25', statut: 'en_cours' },
    ],
    avancements: [
      { id: 'a12', semaine: 'S19', avancement: 48, commentaire: '3 forages sur 4 réalisés, châteaux d\'eau en cours', auteur: 'L. Badji', date: '2026-05-12' },
      { id: 'a13', semaine: 'S20', avancement: 55, commentaire: 'Coffrage château d\'eau n°1 terminé', auteur: 'L. Badji', date: '2026-05-19' },
    ],
  },
];

/* ─ GET all ───────────────────────────────────────────────────────────────── */
router.get('/', (req, res) => {
  const { statut, domaine, region, search } = req.query;
  let projets = [...PROJETS_DPE];

  if (statut)  projets = projets.filter(p => p.statut  === statut);
  if (domaine) projets = projets.filter(p => p.domaine === domaine);
  if (region)  projets = projets.filter(p => p.region.toLowerCase().includes((region as string).toLowerCase()));
  if (search) {
    const q = (search as string).toLowerCase();
    projets = projets.filter(p =>
      p.intitule.toLowerCase().includes(q) ||
      p.code.toLowerCase().includes(q) ||
      p.chefProjet.toLowerCase().includes(q) ||
      p.localite.toLowerCase().includes(q)
    );
  }

  res.json({ projets, total: projets.length });
});

/* ─ GET analytics ─────────────────────────────────────────────────────────── */
router.get('/analytics', (_req, res) => {
  const total = PROJETS_DPE.length;
  const parStatut = {
    planifie:    PROJETS_DPE.filter(p => p.statut === 'planifie').length,
    en_cours:    PROJETS_DPE.filter(p => p.statut === 'en_cours').length,
    suspendu:    PROJETS_DPE.filter(p => p.statut === 'suspendu').length,
    receptionnee: PROJETS_DPE.filter(p => p.statut === 'receptionnee').length,
    cloture:     PROJETS_DPE.filter(p => p.statut === 'cloture').length,
  };

  const avancementMoyen = Math.round(
    PROJETS_DPE.filter(p => p.statut === 'en_cours')
      .reduce((sum, p) => sum + p.avancement, 0) /
    Math.max(1, PROJETS_DPE.filter(p => p.statut === 'en_cours').length)
  );

  const incidentsOuverts = PROJETS_DPE.flatMap(p => p.incidents)
    .filter(i => i.statut !== 'resolu').length;

  const budgetTotal = PROJETS_DPE.reduce((s, p) => s + p.budget, 0);
  const budgetConsomme = PROJETS_DPE.reduce((s, p) => s + p.budgetConsomme, 0);

  const parDomaine = (['electrification','solaire','hydraulique','telecom','BTP','autre'] as DomaineProjet[]).map(d => ({
    domaine: d,
    count: PROJETS_DPE.filter(p => p.domaine === d).length,
    avancement: Math.round(
      PROJETS_DPE.filter(p => p.domaine === d).reduce((s, p) => s + p.avancement, 0) /
      Math.max(1, PROJETS_DPE.filter(p => p.domaine === d).length)
    ),
  })).filter(d => d.count > 0);

  const projetsEnRetard = PROJETS_DPE.filter(p => {
    if (p.statut !== 'en_cours') return false;
    const fin = new Date(p.dateFin);
    const debut = new Date(p.dateDebut);
    const now = new Date('2026-05-24');
    const duree = fin.getTime() - debut.getTime();
    const ecoule = now.getTime() - debut.getTime();
    const attendu = Math.min(100, Math.round((ecoule / duree) * 100));
    return p.avancement < attendu - 10;
  }).length;

  const alertes = PROJETS_DPE
    .filter(p => p.statut === 'en_cours')
    .map(p => {
      const fin = new Date(p.dateFin);
      const debut = new Date(p.dateDebut);
      const now = new Date('2026-05-24');
      const duree = fin.getTime() - debut.getTime();
      const ecoule = now.getTime() - debut.getTime();
      const attendu = Math.min(100, Math.round((ecoule / duree) * 100));
      const ecart = p.avancement - attendu;
      return { ...p, avancementAttendu: attendu, ecart };
    })
    .filter(p => p.ecart < -10)
    .map(p => ({
      id: p.id, code: p.code, intitule: p.intitule, avancement: p.avancement,
      avancementAttendu: p.avancementAttendu, ecart: p.ecart, chefProjet: p.chefProjet,
    }));

  res.json({
    total, parStatut, avancementMoyen, incidentsOuverts,
    budgetTotal, budgetConsomme, parDomaine, projetsEnRetard, alertes,
  });
});

/* ─ GET one ───────────────────────────────────────────────────────────────── */
router.get('/:id', (req, res) => {
  const projet = PROJETS_DPE.find(p => p.id === req.params.id);
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });
  return res.json(projet);
});

/* ─ POST create ───────────────────────────────────────────────────────────── */
router.post('/', (req, res) => {
  const { code, intitule, description, chefProjet, direction, domaine, priorite,
          dateDebut, dateFin, localite, region, lat, lng, budget, entreprise, nbLocalites } = req.body;

  const nouveau: ProjetDPE = {
    id: uuidv4(), code, intitule, description, chefProjet, direction, domaine,
    statut: 'planifie', priorite, dateDebut, dateFin, avancement: 0,
    dateMAJ: new Date().toISOString().split('T')[0], localite, region,
    lat: Number(lat), lng: Number(lng), budget: Number(budget), budgetConsomme: 0,
    entreprise, nbLocalites: Number(nbLocalites) || undefined,
    incidents: [], avancements: [],
  };

  PROJETS_DPE.push(nouveau);
  res.status(201).json(nouveau);
});

/* ─ PATCH update ──────────────────────────────────────────────────────────── */
router.patch('/:id', (req, res) => {
  const idx = PROJETS_DPE.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Projet introuvable' });

  const allowed = ['statut','avancement','chefProjet','dateMAJ','budgetConsomme',
                   'intitule','description','priorite','dateFin'];
  const updates: Partial<ProjetDPE> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) (updates as Record<string, unknown>)[k] = req.body[k];
  }
  updates.dateMAJ = new Date().toISOString().split('T')[0];
  PROJETS_DPE[idx] = { ...PROJETS_DPE[idx], ...updates };
  return res.json(PROJETS_DPE[idx]);
});

/* ─ POST avancement ───────────────────────────────────────────────────────── */
router.post('/:id/avancements', (req, res) => {
  const projet = PROJETS_DPE.find(p => p.id === req.params.id);
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  const { semaine, avancement, commentaire, auteur } = req.body;
  const entry: AvancementHebdo = {
    id: uuidv4(), semaine, avancement: Number(avancement),
    commentaire, auteur, date: new Date().toISOString().split('T')[0],
  };
  projet.avancements.push(entry);
  projet.avancement = Number(avancement);
  projet.dateMAJ = entry.date;
  if (avancement >= 100) projet.statut = 'receptionnee';
  res.status(201).json(entry);
});

/* ─ POST incident ─────────────────────────────────────────────────────────── */
router.post('/:id/incidents', (req, res) => {
  const projet = PROJETS_DPE.find(p => p.id === req.params.id);
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });

  const { type, gravite, description, actionCorrective } = req.body;
  const incident: IncidentProjet = {
    id: uuidv4(), type, gravite, description, actionCorrective,
    date: new Date().toISOString().split('T')[0], statut: 'ouvert',
  };
  projet.incidents.push(incident);
  res.status(201).json(incident);
});

/* ─ PATCH incident statut ─────────────────────────────────────────────────── */
router.patch('/:id/incidents/:iid', (req, res) => {
  const projet = PROJETS_DPE.find(p => p.id === req.params.id);
  if (!projet) return res.status(404).json({ error: 'Projet introuvable' });
  const incident = projet.incidents.find(i => i.id === req.params.iid);
  if (!incident) return res.status(404).json({ error: 'Incident introuvable' });
  if (req.body.statut) incident.statut = req.body.statut;
  if (req.body.actionCorrective) incident.actionCorrective = req.body.actionCorrective;
  return res.json(incident);
});

export default router;
