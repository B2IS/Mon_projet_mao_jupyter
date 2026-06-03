import type { ProjetDPE, Courrier, WorkflowAlerte, DirectionDPE } from './types';

export const DIRECTIONS: DirectionDPE[] = [
  { code: 'DEP', label: 'Direction Équipement Production', labelCourt: 'DEP', couleur: '#F59E0B', directeur: 'Mamadou Ndiaye', mission: 'Suivi et pilotage des projets d\'équipements de production' },
  { code: 'DER', label: 'Direction Équipement Réseaux', labelCourt: 'DER', couleur: '#60A5FA', directeur: 'Ibrahima Sow', mission: 'Projets Transport, Distribution, Électrification Rurale' },
  { code: 'DIT', label: 'Direction Innovation Technologique', labelCourt: 'DIT', couleur: '#A78BFA', directeur: 'Ousmane Diallo', mission: 'Domaine Commercial : AMI, smart grid client, prépaiement, digitalisation' },
  { code: 'DGC', label: 'Direction Génie Civil', labelCourt: 'DGC', couleur: '#FB7185', directeur: 'Fatou Ba', mission: 'Génie civil, Architecture, SIG' },
  { code: 'CPBM-UE', label: 'Coordination Programmes BM–UE', labelCourt: 'CPBM-UE', couleur: '#10B981', directeur: 'Aliou Dieng', mission: 'PASE, PADAES, BEST — BM/UE' },
  { code: 'CC26', label: 'Coordination Compact 2026', labelCourt: 'CC26', couleur: '#F97316', directeur: 'Cheikh Fall', mission: 'MCA-Sénégal II — Transport & Accès' },
  { code: 'CPAMACEL', label: 'Cellule PAMACEL & Efficacité Énergétique', labelCourt: 'CPAMACEL', couleur: '#06B6D4', directeur: 'Adja Traoré', mission: 'Accès universel zones périurbaines' },
  { code: 'CPADERAU', label: 'Cellule PADERAU', labelCourt: 'CPADERAU', couleur: '#22C55E', directeur: 'Moussa Sarr', mission: 'PADERAU — 80M€ AFD/BEI/UE' },
];

export const PROJETS: ProjetDPE[] = [
  {
    id: 'p1', code: 'PRJ-DER-2024-001', direction: 'DER',
    intitule: 'Électrification Rurale 19 Localités — Région de Thiès',
    type: 'electrification_rurale', statut: 'en_cours', priorite: 'haute',
    region: 'Thiès', localite: 'Thiès / Zones rurales',
    chefProjet: 'Aïssatou Ndiaye', directeur: 'Ibrahima Sow',
    dateDebut: '15/01/2024', dateFin: '30/06/2026',
    avancement: 45, budget: 1_250_000_000, budgetEngage: 875_000_000, budgetDecaisse: 560_000_000,
    lat: 14.79, lng: -16.93, nbLocalites: 19, beneficiaires: 12400,
    description: 'Extension réseau HTA/BT pour accès universel à l\'électricité dans 19 localités rurales de Thiès dans le cadre du PADERAU.',
    objectif: 'Électrifier 19 localités, 2 480 ménages, 12 400 bénéficiaires.',
    bailleurs: [
      { code: 'AFD', nom: 'AFD', montant: 6800000, devise: 'EUR', tauxChange: 655.957, montantFCFA: 750_000_000, pourcentage: 60 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 500_000_000, devise: 'FCFA', montantFCFA: 500_000_000, pourcentage: 40 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '15/01/2024', dateFin: '28/02/2024', avancement: 100, statut: 'termine', budgetPrevu: 25_000_000, budgetEngage: 24_500_000, budgetDecaisse: 24_500_000 },
      { code: 'etudes_apd', label: 'Études APD', dateDebut: '01/03/2024', dateFin: '30/04/2024', avancement: 100, statut: 'termine', budgetPrevu: 35_000_000, budgetEngage: 34_000_000, budgetDecaisse: 34_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/05/2024', dateFin: '31/07/2024', avancement: 100, statut: 'termine', budgetPrevu: 5_000_000, budgetEngage: 4_800_000, budgetDecaisse: 4_800_000 },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/08/2024', dateFin: '31/10/2024', avancement: 100, statut: 'termine', budgetPrevu: 380_000_000, budgetEngage: 375_000_000, budgetDecaisse: 280_000_000 },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/11/2024', dateFin: '30/04/2026', avancement: 40, statut: 'en_cours', budgetPrevu: 420_000_000, budgetEngage: 310_000_000, budgetDecaisse: 180_000_000 },
      { code: 'travaux_elec', label: 'Travaux Électriques', dateDebut: '15/01/2025', dateFin: '30/05/2026', avancement: 35, statut: 'en_cours', budgetPrevu: 340_000_000, budgetEngage: 120_000_000, budgetDecaisse: 36_700_000 },
      { code: 'mise_en_service', label: 'Mise en Service', dateDebut: '01/05/2026', dateFin: '30/06/2026', avancement: 0, statut: 'non_demarre', budgetPrevu: 45_000_000, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [
      { id: 'l1', code: 'L001', nom: 'Ndiaye', region: 'Thiès', departement: 'Thiès', lat: 14.85, lng: -17.10, population: 850, nbMenages: 120, distanceReseauKm: 4.5, avancement: 35, statut: 'en_cours', dateDebut: '10/02/2025' },
      { id: 'l2', code: 'L002', nom: 'Keur Samba', region: 'Thiès', departement: 'Thiès', lat: 14.82, lng: -17.05, population: 1200, nbMenages: 180, distanceReseauKm: 6.2, avancement: 0, statut: 'non_demarre' },
      { id: 'l3', code: 'L003', nom: 'Ngoyah', region: 'Thiès', departement: 'Mbour', lat: 14.76, lng: -16.98, population: 650, nbMenages: 95, distanceReseauKm: 3.1, avancement: 65, statut: 'en_cours', dateDebut: '05/11/2024' },
      { id: 'l4', code: 'L004', nom: 'Pambal', region: 'Thiès', departement: 'Tivaouane', lat: 14.95, lng: -16.82, population: 420, nbMenages: 60, distanceReseauKm: 7.8, avancement: 0, statut: 'non_demarre' },
    ],
    marches: [
      { id: 'm1', reference: 'MRK-DER-2024-001', objet: 'Fourniture & Pose câbles HTA/BT', entreprise: 'ELEC AFRIQUE SARL', montantHT: 320_000_000, montantTTC: 377_600_000, dateSignature: '15/07/2024', dateDebut: '01/08/2024', dateFin: '31/12/2025', statut: 'en_cours', avancement: 42 },
      { id: 'm2', reference: 'MRK-DER-2024-002', objet: 'Fourniture transformateurs 160kVA', entreprise: 'ABB SENEGAL', montantHT: 155_000_000, montantTTC: 182_900_000, dateSignature: '20/07/2024', dateDebut: '01/08/2024', dateFin: '30/04/2025', statut: 'termine', avancement: 100 },
    ],
    incidents: [
      { id: 'i1', date: '22/05/2026', type: 'retard', gravite: 'grave' as const, description: 'Retard livraison poteaux béton — rupture stock fournisseur', actionCorrective: 'Contact fournisseur alternatif — livraison attendue 15/06/2026', statut: 'en_cours', responsable: 'Aïssatou Ndiaye' },
      { id: 'i2', date: '11/03/2025', type: 'technique', gravite: 'modere' as const, description: 'Traverse voie ferrée non prévue dans l\'APD (L003)', actionCorrective: 'Avenant contrat établi — coût additionnel 4,2M FCFA', statut: 'resolu', responsable: 'Contrôleur DER' },
    ],
    documents: [
      { id: 'd1', nom: 'Rapport mensuel mai 2026', type: 'rapport_avancement' as const, auteur: 'Aïssatou Ndiaye', date: '24/05/2026', taille: '2.4 MB', version: 'v1.0', projetCode: 'PRJ-DER-2024-001' },
      { id: 'd2', nom: 'APD — 19 localités Thiès', type: 'etude_apd' as const, auteur: 'BCEOM', date: '25/04/2024', taille: '18.7 MB', version: 'v2.1', projetCode: 'PRJ-DER-2024-001' },
      { id: 'd3', nom: 'Contrat MRK-DER-2024-001', type: 'contrat' as const, auteur: 'Cellule PM', date: '15/07/2024', taille: '1.2 MB', version: 'v1.0', projetCode: 'PRJ-DER-2024-001' },
    ],
    taches: [
      { id: 't1', titre: 'Rapport avancement juin 2026', assignee: 'Aïssatou Ndiaye', priorite: 'haute' as const, statut: 'a_faire' as const, dateEcheance: '05/06/2026', dateCreation: '24/05/2026', projetCode: 'PRJ-DER-2024-001', direction: 'DER' as const },
      { id: 't2', titre: 'Réunion chantier Ndiaye (L001)', assignee: 'Contrôleur DER', priorite: 'haute' as const, statut: 'en_cours' as const, dateEcheance: '28/05/2026', dateCreation: '20/05/2026', projetCode: 'PRJ-DER-2024-001', direction: 'DER' as const },
    ],
  },
  {
    id: 'p2', code: 'PRJ-DER-2023-005', direction: 'DER',
    intitule: 'Renforcement Réseau HTA Kaolack — Poste 90/30kV',
    type: 'distribution', statut: 'en_cours', priorite: 'haute',
    region: 'Kaolack', localite: 'Kaolack',
    chefProjet: 'Ibrahima Sow', directeur: 'Ibrahima Sow',
    dateDebut: '01/03/2023', dateFin: '31/12/2025',
    avancement: 78, budget: 3_800_000_000, budgetEngage: 3_420_000_000, budgetDecaisse: 2_850_000_000,
    lat: 14.1390, lng: -16.0720,
    description: 'Construction poste 90/30kV et renforcement réseau HTA/BT pour améliorer la qualité de service à Kaolack.',
    objectif: 'Réduire les délestages et améliorer la qualité de fourniture.',
    bailleurs: [
      { code: 'BM', nom: 'Banque Mondiale — PADAES', montant: 5000000, devise: 'USD', tauxChange: 600, montantFCFA: 3_000_000_000, pourcentage: 79 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 800_000_000, devise: 'FCFA', montantFCFA: 800_000_000, pourcentage: 21 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '01/03/2023', dateFin: '30/04/2023', avancement: 100, statut: 'termine', budgetPrevu: 50_000_000, budgetEngage: 48_000_000, budgetDecaisse: 48_000_000 },
      { code: 'etudes_apd', label: 'Études APD', dateDebut: '01/05/2023', dateFin: '30/06/2023', avancement: 100, statut: 'termine', budgetPrevu: 75_000_000, budgetEngage: 72_000_000, budgetDecaisse: 72_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/07/2023', dateFin: '30/09/2023', avancement: 100, statut: 'termine', budgetPrevu: 8_000_000, budgetEngage: 7_500_000, budgetDecaisse: 7_500_000 },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/10/2023', dateFin: '31/01/2024', avancement: 100, statut: 'termine', budgetPrevu: 1_200_000_000, budgetEngage: 1_180_000_000, budgetDecaisse: 1_100_000_000 },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/02/2024', dateFin: '31/08/2025', avancement: 90, statut: 'en_cours', budgetPrevu: 1_500_000_000, budgetEngage: 1_450_000_000, budgetDecaisse: 1_200_000_000 },
      { code: 'travaux_elec', label: 'Travaux Électriques', dateDebut: '01/06/2024', dateFin: '30/11/2025', avancement: 65, statut: 'en_cours', budgetPrevu: 850_000_000, budgetEngage: 560_000_000, budgetDecaisse: 350_000_000 },
      { code: 'mise_en_service', label: 'Mise en Service', dateDebut: '01/11/2025', dateFin: '31/12/2025', avancement: 0, statut: 'non_demarre', budgetPrevu: 117_000_000, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [],
    marches: [
      { id: 'm3', reference: 'MRK-DER-2023-007', objet: 'Construction poste 90/30kV', entreprise: 'ALSTOM GRID', montantHT: 2_200_000_000, montantTTC: 2_596_000_000, dateSignature: '28/09/2023', dateDebut: '01/10/2023', dateFin: '30/11/2025', statut: 'en_cours', avancement: 75 },
    ],
    incidents: [
      { id: 'i3', date: '15/04/2026', type: 'technique', gravite: 'bloquant' as const, description: 'Câbles souterrains non cartographiés — blocage travaux zone A', actionCorrective: 'Levé topographique complémentaire — DGC/SIG associé', statut: 'en_cours', responsable: 'Ibrahima Sow' },
    ],
    documents: [
      { id: 'd4', nom: 'Rapport avancement T1-2026', type: 'rapport_avancement' as const, auteur: 'Expert S&E DER', date: '10/04/2026', taille: '4.1 MB', version: 'v1.0', projetCode: 'PRJ-DER-2023-005' },
    ],
    taches: [
      { id: 't3', titre: 'Résolution blocage câbles souterrains', assignee: 'Ibrahima Sow', priorite: 'haute' as const, statut: 'en_cours' as const, dateEcheance: '30/05/2026', dateCreation: '15/04/2026', projetCode: 'PRJ-DER-2023-005', direction: 'DER' as const },
    ],
  },
  {
    id: 'p3', code: 'PRJ-DEP-2022-003', direction: 'DEP',
    intitule: 'Centrale Solaire Malicounda 60 MWc',
    type: 'production_renouv', statut: 'reception_provisoire', priorite: 'haute',
    region: 'Mbour', localite: 'Malicounda, Mbour',
    chefProjet: 'Mamadou Ndiaye', directeur: 'Mamadou Ndiaye',
    dateDebut: '01/06/2022', dateFin: '31/03/2026',
    avancement: 95, budget: 22_500_000_000, budgetEngage: 22_200_000_000, budgetDecaisse: 21_800_000_000,
    lat: 14.3747, lng: -16.9972,
    description: 'Construction centrale photovoltaïque 60 MWc avec stockage 20 MWh à Malicounda — IPP Production propre.',
    objectif: 'Renforcer capacité de production renouvelable et réduire dépendance thermique.',
    bailleurs: [
      { code: 'MCA', nom: 'MCA-Sénégal II', montant: 25000000, devise: 'USD', tauxChange: 610, montantFCFA: 15_250_000_000, pourcentage: 68 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 7_250_000_000, devise: 'FCFA', montantFCFA: 7_250_000_000, pourcentage: 32 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '01/06/2022', dateFin: '31/07/2022', avancement: 100, statut: 'termine', budgetPrevu: 150_000_000, budgetEngage: 148_000_000, budgetDecaisse: 148_000_000 },
      { code: 'etudes_apd', label: 'Études APD', dateDebut: '01/08/2022', dateFin: '31/10/2022', avancement: 100, statut: 'termine', budgetPrevu: 250_000_000, budgetEngage: 245_000_000, budgetDecaisse: 245_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/11/2022', dateFin: '28/02/2023', avancement: 100, statut: 'termine', budgetPrevu: 20_000_000, budgetEngage: 19_000_000, budgetDecaisse: 19_000_000 },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/03/2023', dateFin: '31/08/2023', avancement: 100, statut: 'termine', budgetPrevu: 9_500_000_000, budgetEngage: 9_450_000_000, budgetDecaisse: 9_400_000_000 },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/09/2023', dateFin: '30/06/2025', avancement: 100, statut: 'termine', budgetPrevu: 4_200_000_000, budgetEngage: 4_180_000_000, budgetDecaisse: 4_180_000_000 },
      { code: 'travaux_elec', label: 'Travaux Électriques', dateDebut: '01/01/2024', dateFin: '31/12/2025', avancement: 100, statut: 'termine', budgetPrevu: 7_900_000_000, budgetEngage: 7_880_000_000, budgetDecaisse: 7_600_000_000 },
      { code: 'mise_en_service', label: 'Mise en Service', dateDebut: '01/01/2026', dateFin: '31/03/2026', avancement: 100, statut: 'termine', budgetPrevu: 480_000_000, budgetEngage: 478_000_000, budgetDecaisse: 478_000_000 },
      { code: 'reception_prov', label: 'Réception Provisoire', dateDebut: '01/04/2026', dateFin: '30/06/2026', avancement: 60, statut: 'en_cours', budgetPrevu: 0, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [],
    marches: [
      { id: 'm4', reference: 'MRK-DEP-2023-001', objet: 'EPC Centrale Solaire 60 MWc', entreprise: 'SCATEC SOLAR ASA', montantHT: 18_500_000_000, montantTTC: 21_830_000_000, dateSignature: '15/02/2023', dateDebut: '01/03/2023', dateFin: '31/12/2025', statut: 'termine', avancement: 100 },
    ],
    incidents: [],
    documents: [
      { id: 'd5', nom: 'PV Réception Provisoire — Mai 2026', type: 'pv_reception' as const, auteur: 'Commission Réception DEP', date: '15/05/2026', taille: '1.8 MB', version: 'v1.0', projetCode: 'PRJ-DEP-2022-003' },
    ],
    taches: [
      { id: 't4', titre: 'Levée des réserves réception provisoire', assignee: 'Mamadou Ndiaye', priorite: 'haute' as const, statut: 'en_cours' as const, dateEcheance: '15/06/2026', dateCreation: '16/05/2026', projetCode: 'PRJ-DEP-2022-003', direction: 'DEP' as const },
    ],
  },
  {
    id: 'p4', code: 'PRJ-CC26-2023-002', direction: 'CC26',
    intitule: 'Projet Transport 225kV Tobène–Kaolack (MCA-Compact)',
    type: 'transport', statut: 'en_cours', priorite: 'haute',
    region: 'Multi-régions', localite: 'Thiès / Fatick / Kaolack',
    chefProjet: 'Cheikh Fall', directeur: 'Cheikh Fall',
    dateDebut: '01/09/2023', dateFin: '31/12/2027',
    avancement: 28, budget: 65_000_000_000, budgetEngage: 32_000_000_000, budgetDecaisse: 12_800_000_000,
    lat: 14.5000, lng: -16.5000, beneficiaires: 850000,
    description: 'Ligne 225kV de 180 km Tobène–Kaolack + 2 postes — MCA-Sénégal II Compact 2.',
    objectif: 'Renforcer le réseau de transport national, fiabiliser l\'alimentation centre et sud.',
    bailleurs: [
      { code: 'MCA', nom: 'MCA-Sénégal II', montant: 85000000, devise: 'USD', tauxChange: 620, montantFCFA: 52_700_000_000, pourcentage: 81 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 12_300_000_000, devise: 'FCFA', montantFCFA: 12_300_000_000, pourcentage: 19 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '01/09/2023', dateFin: '31/12/2023', avancement: 100, statut: 'termine', budgetPrevu: 800_000_000, budgetEngage: 790_000_000, budgetDecaisse: 790_000_000 },
      { code: 'etudes_apd', label: 'Études APD', dateDebut: '01/01/2024', dateFin: '30/06/2024', avancement: 100, statut: 'termine', budgetPrevu: 1_200_000_000, budgetEngage: 1_180_000_000, budgetDecaisse: 1_180_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/07/2024', dateFin: '31/03/2025', avancement: 90, statut: 'en_retard', budgetPrevu: 80_000_000, budgetEngage: 72_000_000, budgetDecaisse: 72_000_000, observations: 'ANO BM en attente pour lot 2' },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/04/2025', dateFin: '31/12/2025', avancement: 45, statut: 'en_cours', budgetPrevu: 28_000_000_000, budgetEngage: 18_000_000_000, budgetDecaisse: 10_000_000_000 },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/01/2026', dateFin: '31/12/2026', avancement: 5, statut: 'en_cours', budgetPrevu: 22_000_000_000, budgetEngage: 5_000_000_000, budgetDecaisse: 758_000_000 },
      { code: 'travaux_elec', label: 'Travaux Électriques', dateDebut: '01/06/2026', dateFin: '30/09/2027', avancement: 0, statut: 'non_demarre', budgetPrevu: 12_920_000_000, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [],
    marches: [
      { id: 'm5', reference: 'MRK-CC26-2025-001', objet: 'Fourniture pylônes & accessoires (Lot 1)', entreprise: 'NEXANS FRANCE', montantHT: 14_500_000_000, montantTTC: 17_110_000_000, dateSignature: '20/03/2025', dateDebut: '01/04/2025', dateFin: '31/12/2025', statut: 'en_cours', avancement: 60 },
      { id: 'm6', reference: 'MRK-CC26-2025-002', objet: 'Construction Poste 225/90kV Kaolack', entreprise: 'ABB GRID', montantHT: 8_200_000_000, montantTTC: 9_676_000_000, dateSignature: '15/04/2025', dateDebut: '01/05/2025', dateFin: '31/08/2026', statut: 'en_cours', avancement: 12 },
    ],
    incidents: [
      { id: 'i4', date: '10/05/2026', type: 'administratif', gravite: 'grave' as const, description: 'ANO BM non reçu pour Lot 2 passation marchés', actionCorrective: 'Dossier soumis au MCA-SN II le 05/05/2026 — réponse attendue avant 30/06/2026', statut: 'en_cours', responsable: 'Cheikh Fall' },
    ],
    documents: [
      { id: 'd6', nom: 'Rapport Mensuel CC26 — Mai 2026', type: 'rapport_avancement' as const, auteur: 'Responsable S&E CC26', date: '22/05/2026', taille: '5.2 MB', version: 'v1.0', projetCode: 'PRJ-CC26-2023-002' },
    ],
    taches: [
      { id: 't5', titre: 'Suivi ANO BM — Lot 2', assignee: 'Cheikh Fall', priorite: 'haute' as const, statut: 'en_cours' as const, dateEcheance: '30/05/2026', dateCreation: '10/05/2026', projetCode: 'PRJ-CC26-2023-002', direction: 'CC26' as const },
    ],
  },
  {
    id: 'p5', code: 'PRJ-CPADERAU-2024-001', direction: 'CPADERAU',
    intitule: 'PADERAU — Extension HTA/BT Kolda & Ziguinchor',
    type: 'electrification_rurale', statut: 'en_cours', priorite: 'haute',
    region: 'Kolda / Ziguinchor', localite: 'Kolda, Ziguinchor, Sédhiou',
    chefProjet: 'Moussa Sarr', directeur: 'Moussa Sarr',
    dateDebut: '01/04/2024', dateFin: '31/03/2027',
    avancement: 22, budget: 18_500_000_000, budgetEngage: 7_200_000_000, budgetDecaisse: 2_800_000_000,
    lat: 12.9000, lng: -14.9500, nbLocalites: 42, beneficiaires: 38000,
    description: 'Programme PADERAU — Extension HTA/BT pour accès universel dans les régions sud — AFD/BEI/UE (80M€).',
    objectif: '42 localités, 6 300 ménages, 38 000 bénéficiaires dans les régions du sud.',
    bailleurs: [
      { code: 'AFD', nom: 'AFD', montant: 25000000, devise: 'EUR', tauxChange: 655.957, montantFCFA: 9_750_000_000, pourcentage: 52.7 },
      { code: 'BEI', nom: 'BEI', montant: 20000000, devise: 'EUR', tauxChange: 655.957, montantFCFA: 7_000_000_000, pourcentage: 37.8 },
      { code: 'UE', nom: 'UE (subvention)', montant: 1_750_000_000, devise: 'FCFA', montantFCFA: 1_750_000_000, pourcentage: 9.5 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '01/04/2024', dateFin: '31/07/2024', avancement: 100, statut: 'termine', budgetPrevu: 280_000_000, budgetEngage: 275_000_000, budgetDecaisse: 275_000_000 },
      { code: 'etudes_apd', label: 'Études APD', dateDebut: '01/08/2024', dateFin: '31/01/2025', avancement: 85, statut: 'en_cours', budgetPrevu: 420_000_000, budgetEngage: 360_000_000, budgetDecaisse: 280_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/02/2025', dateFin: '31/07/2025', avancement: 40, statut: 'en_cours', budgetPrevu: 35_000_000, budgetEngage: 14_000_000, budgetDecaisse: 14_000_000 },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/08/2025', dateFin: '31/03/2026', avancement: 10, statut: 'en_cours', budgetPrevu: 8_500_000_000, budgetEngage: 2_500_000_000, budgetDecaisse: 450_000_000 },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/04/2026', dateFin: '30/09/2026', avancement: 0, statut: 'non_demarre', budgetPrevu: 5_500_000_000, budgetEngage: 0, budgetDecaisse: 0 },
      { code: 'travaux_elec', label: 'Travaux Électriques', dateDebut: '01/07/2026', dateFin: '31/12/2026', avancement: 0, statut: 'non_demarre', budgetPrevu: 3_765_000_000, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [
      { id: 'l5', code: 'L001', nom: 'Saré Yero Bande', region: 'Kolda', departement: 'Kolda', lat: 12.89, lng: -14.94, population: 1100, nbMenages: 165, distanceReseauKm: 8.2, avancement: 0, statut: 'non_demarre' },
      { id: 'l6', code: 'L002', nom: 'Diaobé', region: 'Kolda', departement: 'Vélingara', lat: 13.01, lng: -14.42, population: 2800, nbMenages: 420, distanceReseauKm: 2.5, avancement: 0, statut: 'non_demarre' },
    ],
    marches: [],
    incidents: [
      { id: 'i5', date: '05/04/2026', type: 'administratif', gravite: 'modere' as const, description: 'Retard APD — complexité levés topographiques en zone forestière', actionCorrective: 'Renforts bureau études mobilisés — drones DGC/SIG', statut: 'en_cours', responsable: 'Moussa Sarr' },
    ],
    documents: [],
    taches: [
      { id: 't6', titre: 'Validation APD lots 1-3', assignee: 'Expert S&E CPADERAU', priorite: 'normale' as const, statut: 'en_cours' as const, dateEcheance: '30/06/2026', dateCreation: '01/04/2026', projetCode: 'PRJ-CPADERAU-2024-001', direction: 'CPADERAU' as const },
    ],
  },
  {
    id: 'p6', code: 'PRJ-DIT-2023-004', direction: 'DIT',
    intitule: 'Smartgrid & AMI National — IDMS Phase 2',
    type: 'smartgrid', statut: 'en_cours', priorite: 'normale',
    region: 'National', localite: 'Dakar, Thiès, Kaolack',
    chefProjet: 'Ousmane Diallo', directeur: 'Ousmane Diallo',
    dateDebut: '01/07/2023', dateFin: '30/06/2026',
    avancement: 62, budget: 8_200_000_000, budgetEngage: 7_100_000_000, budgetDecaisse: 5_500_000_000,
    lat: 14.6937, lng: -17.4441,
    description: 'Déploiement 450 000 compteurs intelligents AMI et infrastructure IDMS sur 3 régions.',
    objectif: 'Améliorer performances commerciales, réduire pertes techniques et commerciales.',
    bailleurs: [
      { code: 'KFW', nom: 'KfW', montant: 10000000, devise: 'EUR', tauxChange: 655.957, montantFCFA: 6_500_000_000, pourcentage: 79.3 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 1_700_000_000, devise: 'FCFA', montantFCFA: 1_700_000_000, pourcentage: 20.7 },
    ],
    phases: [
      { code: 'etudes_apd', label: 'Études & Spécifications', dateDebut: '01/07/2023', dateFin: '31/12/2023', avancement: 100, statut: 'termine', budgetPrevu: 200_000_000, budgetEngage: 198_000_000, budgetDecaisse: 198_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/01/2024', dateFin: '31/05/2024', avancement: 100, statut: 'termine', budgetPrevu: 30_000_000, budgetEngage: 28_000_000, budgetDecaisse: 28_000_000 },
      { code: 'approvisionnement', label: 'Fourniture compteurs', dateDebut: '01/06/2024', dateFin: '31/12/2024', avancement: 100, statut: 'termine', budgetPrevu: 4_500_000_000, budgetEngage: 4_480_000_000, budgetDecaisse: 4_480_000_000 },
      { code: 'travaux_elec', label: 'Installation & Déploiement', dateDebut: '01/01/2025', dateFin: '31/03/2026', avancement: 72, statut: 'en_cours', budgetPrevu: 3_200_000_000, budgetEngage: 2_300_000_000, budgetDecaisse: 780_000_000 },
      { code: 'mise_en_service', label: 'Mise en Service IDMS', dateDebut: '01/04/2026', dateFin: '30/06/2026', avancement: 30, statut: 'en_cours', budgetPrevu: 270_000_000, budgetEngage: 94_000_000, budgetDecaisse: 14_000_000 },
    ],
    localites: [],
    marches: [
      { id: 'm7', reference: 'MRK-DIT-2024-001', objet: 'Fourniture 450 000 compteurs AMI', entreprise: 'LANDIS+GYR AG', montantHT: 5_800_000_000, montantTTC: 6_844_000_000, dateSignature: '30/05/2024', dateDebut: '01/06/2024', dateFin: '31/12/2024', statut: 'termine', avancement: 100 },
      { id: 'm8', reference: 'MRK-DIT-2024-002', objet: 'Déploiement & Intégration IDMS', entreprise: 'ENGIE SOLUTIONS', montantHT: 1_900_000_000, montantTTC: 2_242_000_000, dateSignature: '01/06/2024', dateDebut: '01/01/2025', dateFin: '30/06/2026', statut: 'en_cours', avancement: 60 },
    ],
    incidents: [],
    documents: [
      { id: 'd7', nom: 'Rapport Installation Q1-2026', type: 'rapport_avancement' as const, auteur: 'DIT/DSSE', date: '15/04/2026', taille: '3.8 MB', version: 'v1.0', projetCode: 'PRJ-DIT-2023-004' },
    ],
    taches: [
      { id: 't7', titre: 'Recette IDMS vague 3 (Kaolack)', assignee: 'Expert DSSE', priorite: 'normale' as const, statut: 'a_faire' as const, dateEcheance: '15/06/2026', dateCreation: '01/05/2026', projetCode: 'PRJ-DIT-2023-004', direction: 'DIT' as const },
    ],
  },
  {
    id: 'p7', code: 'PRJ-DGC-2024-002', direction: 'DGC',
    intitule: 'Construction Siège DPE & Bâtiments Techniques Kaolack',
    type: 'distribution', statut: 'appel_offres', priorite: 'normale',
    region: 'Kaolack', localite: 'Kaolack, Zone Industrie',
    chefProjet: 'Fatou Ba', directeur: 'Fatou Ba',
    dateDebut: '01/02/2024', dateFin: '31/12/2026',
    avancement: 15, budget: 2_800_000_000, budgetEngage: 420_000_000, budgetDecaisse: 180_000_000,
    lat: 14.1500, lng: -16.0800,
    description: 'Construction siège régional DPE et bâtiments techniques pour les opérations DER/Kaolack.',
    objectif: 'Doter la DER de Kaolack d\'infrastructures modernes adaptées à ses missions.',
    bailleurs: [
      { code: 'SENELEC', nom: 'SENELEC Budget Investissement', montant: 2_800_000_000, devise: 'FCFA', montantFCFA: 2_800_000_000, pourcentage: 100 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études APS', dateDebut: '01/02/2024', dateFin: '30/04/2024', avancement: 100, statut: 'termine', budgetPrevu: 80_000_000, budgetEngage: 78_000_000, budgetDecaisse: 78_000_000 },
      { code: 'etudes_apd', label: 'Études APD & DAO', dateDebut: '01/05/2024', dateFin: '30/09/2024', avancement: 100, statut: 'termine', budgetPrevu: 120_000_000, budgetEngage: 118_000_000, budgetDecaisse: 102_000_000 },
      { code: 'passation_marche', label: 'Appel d\'Offres & Attribution', dateDebut: '01/10/2024', dateFin: '30/06/2026', avancement: 45, statut: 'en_cours', budgetPrevu: 20_000_000, budgetEngage: 9_000_000, budgetDecaisse: 0, observations: 'AO lancé 15/10/2024 — 3 offres reçues — analyse en cours' },
      { code: 'travaux_gc', label: 'Travaux Génie Civil', dateDebut: '01/07/2026', dateFin: '30/11/2026', avancement: 0, statut: 'non_demarre', budgetPrevu: 2_400_000_000, budgetEngage: 0, budgetDecaisse: 0 },
    ],
    localites: [],
    marches: [],
    incidents: [],
    documents: [
      { id: 'd8', nom: 'DAO Bâtiments Kaolack — Lot 1', type: 'dao' as const, auteur: 'Unité Architecture DGC', date: '15/10/2024', taille: '45.2 MB', version: 'v3.0', projetCode: 'PRJ-DGC-2024-002' },
    ],
    taches: [
      { id: 't8', titre: 'Analyse offres AO bâtiments (Lot 1 & 2)', assignee: 'Chef Dept Investissements DGC', priorite: 'haute' as const, statut: 'en_cours' as const, dateEcheance: '15/06/2026', dateCreation: '10/05/2026', projetCode: 'PRJ-DGC-2024-002', direction: 'DGC' as const },
    ],
  },
  {
    id: 'p8', code: 'PRJ-CPBM-2022-001', direction: 'CPBM-UE',
    intitule: 'BEST — Extension Réseau BT Dakar Banlieue',
    type: 'distribution', statut: 'en_cours', priorite: 'haute',
    region: 'Dakar', localite: 'Dakar — Banlieue',
    chefProjet: 'Aliou Dieng', directeur: 'Aliou Dieng',
    dateDebut: '01/01/2022', dateFin: '30/06/2026',
    avancement: 88, budget: 12_000_000_000, budgetEngage: 11_400_000_000, budgetDecaisse: 10_200_000_000,
    lat: 14.7000, lng: -17.4500, nbLocalites: 8, beneficiaires: 95000,
    description: 'Programme BEST (PRAE-ECOWAS) — Extension réseau BT banlieue dakaroise, réduction des pertes.',
    objectif: '15 800 nouveaux abonnés — réduction pertes 22% → 14%.',
    bailleurs: [
      { code: 'BM', nom: 'BM — PRAE-ECOWAS/BEST', montant: 14000000, devise: 'USD', tauxChange: 600, montantFCFA: 8_400_000_000, pourcentage: 70 },
      { code: 'UE', nom: 'Union Européenne', montant: 2_700_000_000, devise: 'FCFA', montantFCFA: 2_700_000_000, pourcentage: 22.5 },
      { code: 'SENELEC', nom: 'SENELEC', montant: 900_000_000, devise: 'FCFA', montantFCFA: 900_000_000, pourcentage: 7.5 },
    ],
    phases: [
      { code: 'etudes_aps', label: 'Études', dateDebut: '01/01/2022', dateFin: '30/04/2022', avancement: 100, statut: 'termine', budgetPrevu: 200_000_000, budgetEngage: 198_000_000, budgetDecaisse: 198_000_000 },
      { code: 'passation_marche', label: 'Passation Marchés', dateDebut: '01/05/2022', dateFin: '31/10/2022', avancement: 100, statut: 'termine', budgetPrevu: 25_000_000, budgetEngage: 24_000_000, budgetDecaisse: 24_000_000 },
      { code: 'approvisionnement', label: 'Approvisionnement', dateDebut: '01/11/2022', dateFin: '30/04/2023', avancement: 100, statut: 'termine', budgetPrevu: 4_200_000_000, budgetEngage: 4_180_000_000, budgetDecaisse: 4_180_000_000 },
      { code: 'travaux_gc', label: 'Travaux GC & Câblage', dateDebut: '01/05/2023', dateFin: '31/03/2026', avancement: 95, statut: 'en_cours', budgetPrevu: 6_800_000_000, budgetEngage: 6_750_000_000, budgetDecaisse: 5_600_000_000 },
      { code: 'mise_en_service', label: 'Mise en Service', dateDebut: '01/01/2026', dateFin: '30/06/2026', avancement: 60, statut: 'en_cours', budgetPrevu: 775_000_000, budgetEngage: 248_000_000, budgetDecaisse: 198_000_000 },
    ],
    localites: [],
    marches: [
      { id: 'm9', reference: 'MRK-CPBM-2022-003', objet: 'Câbles BT & accessoires (Lot 2)', entreprise: 'NEXANS MAROC', montantHT: 3_800_000_000, montantTTC: 4_484_000_000, dateSignature: '25/10/2022', dateDebut: '01/11/2022', dateFin: '30/04/2023', statut: 'termine', avancement: 100 },
    ],
    incidents: [],
    documents: [
      { id: 'd9', nom: 'Rapport Semestriel BEST — S1 2026', type: 'rapport_avancement' as const, auteur: 'Expert S&E CPBM-UE', date: '20/04/2026', taille: '6.8 MB', version: 'v1.0', projetCode: 'PRJ-CPBM-2022-001' },
    ],
    taches: [
      { id: 't9', titre: 'Rapport clôture BM (ICR)', assignee: 'Aliou Dieng', priorite: 'haute' as const, statut: 'a_faire' as const, dateEcheance: '31/07/2026', dateCreation: '01/05/2026', projetCode: 'PRJ-CPBM-2022-001', direction: 'CPBM-UE' as const },
    ],
  },
];

export const COURRIERS: Courrier[] = [
  {
    id: 'c1', reference: 'ENT/DPE/2026/0124', type: 'entrant',
    objet: 'Demande ANO passation marchés Lot 2 — Tobène-Kaolack',
    expediteur: 'MCA-Sénégal II', destinataire: 'Directeur Principal DPE',
    direction: 'CC26', projetCode: 'PRJ-CC26-2023-002',
    statut: 'en_cours_traitement', priorite: 'urgente', categorie: 'demande',
    dateReception: '10/05/2026', dateEcheance: '31/05/2026',
    resume: 'La BM demande des clarifications sur les critères d\'évaluation avant émission de l\'ANO pour le Lot 2.',
    pieceJointe: true, nombrePJ: 3,
    circuit: [
      { etape: 1, role: 'Secrétariat DPE', agent: 'Astou Diallo', statut: 'approuve', dateAction: '10/05/2026', commentaire: 'Enregistré et transmis' },
      { etape: 2, role: 'Coordonnateur CC26', agent: 'Cheikh Fall', statut: 'approuve', dateAction: '11/05/2026', commentaire: 'Réponse en préparation' },
      { etape: 3, role: 'Directeur Principal DPE', agent: 'Directeur DPE', statut: 'en_attente' },
    ],
  },
  {
    id: 'c2', reference: 'ENT/DPE/2026/0118', type: 'entrant',
    objet: 'Rapport de supervision mission BM — Mai 2026',
    expediteur: 'Banque Mondiale (Task Team Leader)', destinataire: 'CPBM-UE / DER',
    direction: 'CPBM-UE', projetCode: 'PRJ-CPBM-2022-001',
    statut: 'traite', priorite: 'normale', categorie: 'rapport',
    dateReception: '05/05/2026',
    resume: 'Évaluation satisfaisante du projet BEST. Points d\'attention sur raccordements zone Pikine.',
    pieceJointe: true, nombrePJ: 1,
    circuit: [
      { etape: 1, role: 'Secrétariat DPE', agent: 'Astou Diallo', statut: 'approuve', dateAction: '05/05/2026' },
      { etape: 2, role: 'Chef CPBM-UE', agent: 'Aliou Dieng', statut: 'approuve', dateAction: '07/05/2026', commentaire: 'Distribué — plan d\'action établi' },
    ],
  },
  {
    id: 'c3', reference: 'ENT/DPE/2026/0112', type: 'entrant',
    objet: 'Facture N°2026/087 — Décompte n°4 — ELEC AFRIQUE SARL',
    expediteur: 'ELEC AFRIQUE SARL', destinataire: 'DER / RAF',
    direction: 'DER', projetCode: 'PRJ-DER-2024-001',
    statut: 'en_attente_visa', priorite: 'normale', categorie: 'facture',
    dateReception: '28/04/2026', dateEcheance: '28/05/2026',
    resume: 'Décompte n°4 — Montant : 45 800 000 FCFA TTC — travaux mars-avril 2026.',
    pieceJointe: true, nombrePJ: 5,
    circuit: [
      { etape: 1, role: 'Secrétariat DER', agent: 'Khadija Ba', statut: 'approuve', dateAction: '28/04/2026' },
      { etape: 2, role: 'Chef de Projet DER', agent: 'Aïssatou Ndiaye', statut: 'approuve', dateAction: '02/05/2026', commentaire: 'Conforme aux attachements' },
      { etape: 3, role: 'RAF DER', agent: 'Resp. Admin. Financier', statut: 'en_attente' },
      { etape: 4, role: 'Directeur DER', agent: 'Ibrahima Sow', statut: 'en_attente' },
    ],
  },
  {
    id: 'c4', reference: 'ENT/DPE/2026/0098', type: 'entrant',
    objet: 'Plainte riverains — Nuisances chantier Poste 90/30kV Kaolack',
    expediteur: 'Mairie de Kaolack', destinataire: 'DER / Chef de Projet',
    direction: 'DER', projetCode: 'PRJ-DER-2023-005',
    statut: 'traite', priorite: 'urgente', categorie: 'demande',
    dateReception: '18/04/2026',
    resume: 'Riverains se plaignent vibrations/bruit travaux nocturnes. Demande respect horaires légaux.',
    pieceJointe: false, nombrePJ: 0,
    circuit: [
      { etape: 1, role: 'DER', agent: 'Ibrahima Sow', statut: 'approuve', dateAction: '19/04/2026', commentaire: 'Instructions données — arrêt travaux nocturnes' },
    ],
  },
  {
    id: 'c5', reference: 'ENT/DPE/2026/0089', type: 'entrant',
    objet: 'Demande réunion coordination trimestrielle — AFD/BEI',
    expediteur: 'Agence Française de Développement', destinataire: 'Chef Cellule CPADERAU',
    direction: 'CPADERAU', projetCode: 'PRJ-CPADERAU-2024-001',
    statut: 'traite', priorite: 'normale', categorie: 'demande',
    dateReception: '10/04/2026',
    resume: 'AFD et BEI proposent réunion coordination trimestrielle le 22/05/2026 à Dakar.',
    pieceJointe: false, nombrePJ: 0,
    circuit: [
      { etape: 1, role: 'CPADERAU', agent: 'Moussa Sarr', statut: 'approuve', dateAction: '12/04/2026', commentaire: 'Confirmé le 22/05/2026' },
    ],
  },
  {
    id: 'c6', reference: 'SRT/DPE/2026/0067', type: 'sortant',
    objet: 'Réponse clarifications ANO Lot 2 Tobène-Kaolack',
    expediteur: 'Directeur Principal DPE', destinataire: 'MCA-Sénégal II',
    direction: 'CC26', projetCode: 'PRJ-CC26-2023-002',
    statut: 'envoye', priorite: 'urgente', categorie: 'reponse',
    dateEnvoi: '20/05/2026', signataire: 'Directeur Principal DPE',
    resume: 'Réponse aux 7 points de clarification BM — tableau récapitulatif joint.',
    pieceJointe: true, nombrePJ: 2,
    circuit: [
      { etape: 1, role: 'CC26', agent: 'Cheikh Fall', statut: 'approuve', dateAction: '18/05/2026' },
      { etape: 2, role: 'Directeur DPE', agent: 'Directeur DPE', statut: 'approuve', dateAction: '20/05/2026' },
    ],
  },
  {
    id: 'c7', reference: 'SRT/DPE/2026/0062', type: 'sortant',
    objet: 'Rapport mensuel DPE — Avril 2026 — COMSP',
    expediteur: 'Directeur Principal DPE', destinataire: 'Direction Générale SENELEC',
    direction: 'DEP',
    statut: 'envoye', priorite: 'normale', categorie: 'rapport',
    dateEnvoi: '12/05/2026', signataire: 'Directeur Principal DPE',
    resume: 'Rapport mensuel portefeuille DPE — avancement, budget, alertes — pour COMSP avril 2026.',
    pieceJointe: true, nombrePJ: 1,
    circuit: [
      { etape: 1, role: 'Cellule S&E DPE', agent: 'Expert S&E DPE', statut: 'approuve', dateAction: '10/05/2026' },
      { etape: 2, role: 'Directeur Principal', agent: 'Directeur DPE', statut: 'approuve', dateAction: '12/05/2026' },
    ],
  },
  {
    id: 'c8', reference: 'SRT/DPE/2026/0055', type: 'sortant',
    objet: 'Mise en demeure — ALSTOM GRID — Retard Poste Kaolack',
    expediteur: 'Directeur DER', destinataire: 'ALSTOM GRID',
    direction: 'DER', projetCode: 'PRJ-DER-2023-005',
    statut: 'envoye', priorite: 'urgente', categorie: 'note_service',
    dateEnvoi: '25/04/2026', signataire: 'Directeur DER',
    resume: 'Mise en demeure formelle — retard 45 jours — application pénalités art. 18.2.',
    pieceJointe: true, nombrePJ: 2,
    circuit: [
      { etape: 1, role: 'Chef de Projet', agent: 'Ibrahima Sow', statut: 'approuve', dateAction: '24/04/2026' },
      { etape: 2, role: 'Juriste SENELEC', agent: 'Juriste', statut: 'approuve', dateAction: '24/04/2026' },
      { etape: 3, role: 'Directeur DER', agent: 'Ibrahima Sow', statut: 'approuve', dateAction: '25/04/2026' },
    ],
  },
  {
    id: 'c9', reference: 'SRT/DPE/2026/0041', type: 'sortant',
    objet: 'Note technique — Mission terrain PADERAU Kolda — Mars 2026',
    expediteur: 'Chef Cellule CPADERAU', destinataire: 'AFD Dakar / BEI Abidjan',
    direction: 'CPADERAU', projetCode: 'PRJ-CPADERAU-2024-001',
    statut: 'envoye', priorite: 'normale', categorie: 'note_service',
    dateEnvoi: '15/04/2026', signataire: 'Chef Cellule CPADERAU',
    resume: 'Rapport mission terrain 10-14 mars 2026 Kolda — état APD et prochaines étapes.',
    pieceJointe: true, nombrePJ: 3,
    circuit: [
      { etape: 1, role: 'Expert S&E', agent: 'Expert S&E', statut: 'approuve', dateAction: '14/04/2026' },
      { etape: 2, role: 'Chef Cellule', agent: 'Moussa Sarr', statut: 'approuve', dateAction: '15/04/2026' },
    ],
  },
  {
    id: 'c10', reference: 'SRT/DPE/2026/0033', type: 'sortant',
    objet: 'Convocation réunion coordination mensuelle DPE — Mai 2026',
    expediteur: 'Secrétariat DPE', destinataire: 'Directeurs DEP, DER, DIT, DGC, Coordonnateurs',
    direction: 'DEP',
    statut: 'envoye', priorite: 'normale', categorie: 'compte_rendu',
    dateEnvoi: '20/04/2026', signataire: 'Directeur Principal DPE',
    resume: 'Convocation réunion coordination mensuelle DPE 05/05/2026 à 9h00.',
    pieceJointe: true, nombrePJ: 1,
    circuit: [
      { etape: 1, role: 'Secrétariat', agent: 'Astou Diallo', statut: 'approuve', dateAction: '20/04/2026' },
    ],
  },
];

export const ALERTES_WORKFLOW: WorkflowAlerte[] = [
  { id: 'a1', type: 'retard', projetCode: 'PRJ-CC26-2023-002', message: 'ANO BM Lot 2 non reçu — retard passation marchés de 52 jours', date: '10/05/2026', statut: 'nouvelle', destinataire: 'CC26 + Directeur DPE', priorite: 'critique' },
  { id: 'a2', type: 'incident_grave', projetCode: 'PRJ-DER-2023-005', message: 'Câbles souterrains non cartographiés — blocage travaux zone A Kaolack', date: '15/04/2026', statut: 'nouvelle', destinataire: 'Directeur DER + DGC/SIG', priorite: 'haute' },
  { id: 'a3', type: 'budget', projetCode: 'PRJ-DEP-2022-003', message: 'Taux de décaissement 96.9% — clôture financière MCA à préparer', date: '20/05/2026', statut: 'vue', destinataire: 'Directeur DEP + RAF', priorite: 'haute' },
  { id: 'a4', type: 'reception', projetCode: 'PRJ-DEP-2022-003', message: 'Réception provisoire Malicounda — levée réserves attendue avant 15/06/2026', date: '16/05/2026', statut: 'vue', destinataire: 'Directeur DEP + DG SENELEC', priorite: 'normale' },
  { id: 'a5', type: 'retard', projetCode: 'PRJ-DER-2024-001', message: 'Retard livraison poteaux béton — risque glissement planning 3 semaines', date: '22/05/2026', statut: 'nouvelle', destinataire: 'Chef Projet DER + RAF', priorite: 'haute' },
  { id: 'a6', type: 'echeance_courrier', projetCode: 'PRJ-DER-2024-001', message: 'Facture ELEC AFRIQUE (ENT/DPE/2026/0112) — échéance paiement dans 6 jours', date: '22/05/2026', statut: 'nouvelle', destinataire: 'RAF DER + Directeur DER', priorite: 'haute' },
];

export function getAnalytics() {
  const total = PROJETS.length;
  const enCours = PROJETS.filter(p => p.statut === 'en_cours').length;
  const enEtude = PROJETS.filter(p => ['etude', 'appel_offres'].includes(p.statut)).length;
  const receptionnees = PROJETS.filter(p => ['reception_provisoire', 'reception_definitive'].includes(p.statut)).length;
  const suspendus = PROJETS.filter(p => p.statut === 'suspendu').length;
  const clotures = PROJETS.filter(p => p.statut === 'cloture').length;
  const avancementMoyen = Math.round(PROJETS.reduce((s, p) => s + p.avancement, 0) / total);
  const budgetTotal = PROJETS.reduce((s, p) => s + p.budget, 0);
  const budgetEngage = PROJETS.reduce((s, p) => s + p.budgetEngage, 0);
  const budgetDecaisse = PROJETS.reduce((s, p) => s + p.budgetDecaisse, 0);
  const tauxDecaissement = Math.round((budgetDecaisse / budgetTotal) * 100);
  const totalLocalites = PROJETS.reduce((s, p) => s + (p.nbLocalites || 0), 0);
  const totalBeneficiaires = PROJETS.reduce((s, p) => s + (p.beneficiaires || 0), 0);
  const incidentsOuverts = PROJETS.flatMap(p => p.incidents).filter(i => i.statut !== 'resolu').length;
  const alertesActives = ALERTES_WORKFLOW.filter(a => a.statut === 'nouvelle').length;
  const courrierEnAttente = COURRIERS.filter(c => ['en_cours_traitement', 'en_attente_visa'].includes(c.statut)).length;
  const tachesEnRetard = PROJETS.flatMap(p => p.taches).filter(t => t.statut !== 'termine').length;
  return { total, enCours, enEtude, receptionnees, suspendus, clotures, avancementMoyen, budgetTotal, budgetEngage, budgetDecaisse, tauxDecaissement, totalLocalites, totalBeneficiaires, incidentsOuverts, alertesActives, courrierEnAttente, tachesEnRetard };
}
