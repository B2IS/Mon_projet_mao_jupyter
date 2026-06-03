/**
 * translations.ts — Dictionnaires de traduction SIGEPP-DPE
 * Langues supportées : Français (fr), English (en)
 */

export type Lang = 'fr' | 'en';

export type TranslationKey =
  // Layout
  | 'app.title' | 'app.subtitle'
  | 'nav.home' | 'nav.dashboard' | 'nav.portfolio' | 'nav.projects' | 'nav.myProjects'
  | 'nav.planning' | 'nav.gantt' | 'nav.wbs' | 'nav.tasks'
  | 'nav.execution' | 'nav.terrain' | 'nav.risks' | 'nav.map'
  | 'nav.finances' | 'nav.budget' | 'nav.evm' | 'nav.markets'
  | 'nav.logistics' | 'nav.fleet' | 'nav.odm'
  | 'nav.transverses' | 'nav.ged' | 'nav.courriers' | 'nav.reporting' | 'nav.workflows' | 'nav.aiAgents'
  | 'nav.indicatorBuilder' | 'nav.assets'
  | 'nav.administration' | 'nav.parameters'
  | 'nav.logout'

  // Auth
  | 'auth.login' | 'auth.email' | 'auth.password' | 'auth.signIn'
  | 'auth.welcome' | 'auth.demoAccounts' | 'auth.allPersonnel'
  | 'auth.admin' | 'auth.role'

  // Dashboard / KPI
  | 'kpi.projects' | 'kpi.budget' | 'kpi.progress' | 'kpi.delayed'
  | 'kpi.alerts' | 'kpi.performance'
  | 'dashboard.portfolioView' | 'dashboard.myView'
  | 'dashboard.arbitrages' | 'dashboard.curveS'

  // Projects
  | 'project.name' | 'project.code' | 'project.status' | 'project.domain'
  | 'project.budget' | 'project.engaged' | 'project.spent'
  | 'project.startDate' | 'project.endDate' | 'project.manager'
  | 'project.priority' | 'project.advancement'
  | 'project.new' | 'project.edit' | 'project.delete'

  // Generic
  | 'generic.search' | 'generic.filter' | 'generic.export' | 'generic.save'
  | 'generic.cancel' | 'generic.confirm' | 'generic.close' | 'generic.add'
  | 'generic.edit' | 'generic.delete' | 'generic.view' | 'generic.back'
  | 'generic.loading' | 'generic.error' | 'generic.success' | 'generic.empty'
  | 'generic.yes' | 'generic.no' | 'generic.ok'

  // Direction / Org
  | 'org.dpe' | 'org.dep' | 'org.der' | 'org.dgc' | 'org.dit'
  | 'org.cc26' | 'org.cpbmue' | 'org.cpaderau' | 'org.cpamacel'
  | 'org.dpt' | 'org.dpd' | 'org.direction' | 'org.department' | 'org.unit'

  // Migration IA
  | 'migration.title' | 'migration.upload' | 'migration.analyze'
  | 'migration.validate' | 'migration.generate' | 'migration.step1'
  | 'migration.step2' | 'migration.step3' | 'migration.step4' | 'migration.step5'
  | 'migration.dropFiles' | 'migration.documents' | 'migration.contracts'
  | 'migration.reports' | 'migration.pv' | 'migration.plans'

  // Flexibility
  | 'flex.addColumn' | 'flex.addRow' | 'flex.addItem' | 'flex.configure'
  | 'flex.customField' | 'flex.saveView' | 'flex.loadView'
  // Route titles (Header)
  | 'route.tableauDeBord.label' | 'route.tableauDeBord.sub'
  | 'route.portefeuille.label' | 'route.portefeuille.sub'
  | 'route.programmes.label' | 'route.programmes.sub'
  | 'route.projets.label' | 'route.projets.sub'
  | 'route.cockpitProjet.label' | 'route.cockpitProjet.sub'
  | 'route.terrain.label' | 'route.terrain.sub'
  | 'route.taches.label' | 'route.taches.sub'
  | 'route.budget.label' | 'route.budget.sub'
  | 'route.courriers.label' | 'route.courriers.sub'
  | 'route.analytique.label' | 'route.analytique.sub'
  | 'route.cartographie.label' | 'route.cartographie.sub'
  | 'route.workflows.label' | 'route.workflows.sub'
  | 'route.administration.label' | 'route.administration.sub'
  | 'route.suiviEvaluation.label' | 'route.suiviEvaluation.sub'
  | 'route.odm.label' | 'route.odm.sub'
  | 'route.flotte.label' | 'route.flotte.sub'
  | 'route.receptions.label' | 'route.receptions.sub'
  | 'route.marches.label' | 'route.marches.sub'
  | 'route.gantt.label' | 'route.gantt.sub'
  | 'route.studioRapports.label' | 'route.studioRapports.sub'
  | 'route.reporting.label' | 'route.reporting.sub'
  | 'route.rh.label' | 'route.rh.sub'
  | 'route.wbs.label' | 'route.wbs.sub'
  | 'route.evm.label' | 'route.evm.sub'
  | 'route.risques.label' | 'route.risques.sub'
  | 'route.ged.label' | 'route.ged.sub'
  | 'route.agentsIa.label' | 'route.agentsIa.sub'
  | 'route.dashboardBuilder.label' | 'route.dashboardBuilder.sub'

  // Sidebar sections
  | 'sidebar.accueil' | 'sidebar.portefeuilleProjets' | 'sidebar.executionControle'
  | 'sidebar.financesEngagements' | 'sidebar.logistiqueRessources' | 'sidebar.transverses'

  | 'lang.fr' | 'lang.en';

const FR: Record<TranslationKey, string> = {
  'app.title': 'SIGEPP — DPE',
  'app.subtitle': 'Système Intégré de Gestion des Projets et Programmes',
  'nav.home': 'Accueil',
  'nav.dashboard': 'Tableau de bord',
  'nav.portfolio': 'Portefeuille',
  'nav.projects': 'Projets',
  'nav.myProjects': 'Mes Projets',
  'nav.planning': 'Planning',
  'nav.gantt': 'Gantt',
  'nav.wbs': 'WBS',
  'nav.tasks': 'Tâches',
  'nav.execution': 'Exécution',
  'nav.terrain': 'Terrain',
  'nav.risks': 'Risques',
  'nav.map': 'Cartographie',
  'nav.finances': 'Finances',
  'nav.budget': 'Budget',
  'nav.evm': 'EVM',
  'nav.markets': 'Marchés',
  'nav.logistics': 'Logistique',
  'nav.fleet': 'Flotte',
  'nav.odm': 'ODM',
  'nav.transverses': 'Transverses',
  'nav.ged': 'GED',
  'nav.courriers': 'Courriers',
  'nav.reporting': 'Reporting',
  'nav.workflows': 'Workflows',
  'nav.aiAgents': 'Agents IA',
  'nav.indicatorBuilder': 'Constructeur d\'Indicateurs',
  'nav.assets': 'Immobilisations & Amortissements',
  'nav.administration': 'Administration',
  'nav.parameters': 'Paramétrage',
  'nav.logout': 'Déconnexion',

  'auth.login': 'Connexion',
  'auth.email': 'Email',
  'auth.password': 'Mot de passe',
  'auth.signIn': 'Se connecter',
  'auth.welcome': 'Bienvenue sur SIGEPP-DPE',
  'auth.demoAccounts': 'Comptes rapides',
  'auth.allPersonnel': 'agents du personnel DPE disponibles',
  'auth.admin': 'Administrateur',
  'auth.role': 'Rôle',

  'kpi.projects': 'Projets',
  'kpi.budget': 'Budget',
  'kpi.progress': 'Avancement',
  'kpi.delayed': 'En retard',
  'kpi.alerts': 'Alertes',
  'kpi.performance': 'Performance',
  'dashboard.portfolioView': 'Vue Portefeuille',
  'dashboard.myView': 'Ma Vue',
  'dashboard.arbitrages': 'Arbitrages',
  'dashboard.curveS': 'Courbe S',

  'project.name': 'Nom du projet',
  'project.code': 'Code',
  'project.status': 'Statut',
  'project.domain': 'Domaine',
  'project.budget': 'Budget',
  'project.engaged': 'Engagé',
  'project.spent': 'Décaissé',
  'project.startDate': 'Début',
  'project.endDate': 'Fin prévue',
  'project.manager': 'Chef de projet',
  'project.priority': 'Priorité',
  'project.advancement': 'Avancement',
  'project.new': 'Nouveau projet',
  'project.edit': 'Modifier le projet',
  'project.delete': 'Supprimer le projet',

  'generic.search': 'Rechercher',
  'generic.filter': 'Filtrer',
  'generic.export': 'Exporter',
  'generic.save': 'Enregistrer',
  'generic.cancel': 'Annuler',
  'generic.confirm': 'Confirmer',
  'generic.close': 'Fermer',
  'generic.add': 'Ajouter',
  'generic.edit': 'Modifier',
  'generic.delete': 'Supprimer',
  'generic.view': 'Voir',
  'generic.back': 'Retour',
  'generic.loading': 'Chargement...',
  'generic.error': 'Erreur',
  'generic.success': 'Succès',
  'generic.empty': 'Aucune donnée',
  'generic.yes': 'Oui',
  'generic.no': 'Non',
  'generic.ok': 'OK',

  'org.dpe': 'DPE',
  'org.dep': 'DEP — Production',
  'org.der': 'DER — Réseaux',
  'org.dgc': 'DGC — Génie Civil',
  'org.dit': 'DIT — Innovation',
  'org.cc26': 'CC26 — Compact 2026',
  'org.cpbmue': 'CPBM-UE',
  'org.cpaderau': 'CPADERAU',
  'org.cpamacel': 'CPAMACEL & EE',
  'org.dpt': 'DPT — Transport',
  'org.dpd': 'DPD — Distribution',
  'org.direction': 'Direction',
  'org.department': 'Département',
  'org.unit': 'Unité',

  'migration.title': 'Migration intelligente de projet',
  'migration.upload': 'Charger les documents',
  'migration.analyze': 'Analyse IA',
  'migration.validate': 'Validation humaine',
  'migration.generate': 'Génération SIGEPP',
  'migration.step1': 'Étape 1 — Upload',
  'migration.step2': 'Étape 2 — Analyse IA',
  'migration.step3': 'Étape 3 — Construction',
  'migration.step4': 'Étape 4 — Validation',
  'migration.step5': 'Étape 5 — Finalisation',
  'migration.dropFiles': 'Déposez vos documents ici',
  'migration.documents': 'Documents',
  'migration.contracts': 'Contrats',
  'migration.reports': 'Rapports',
  'migration.pv': 'PV',
  'migration.plans': 'Plans',

  'flex.addColumn': 'Ajouter une colonne',
  'flex.addRow': 'Ajouter une ligne',
  'flex.addItem': 'Ajouter un élément',
  'flex.configure': 'Configurer',
  'flex.customField': 'Champ personnalisé',
  'flex.saveView': 'Sauvegarder la vue',
  'flex.loadView': 'Charger une vue',

  'route.tableauDeBord.label': 'Accueil — Cockpit Direction / PMO',
  'route.tableauDeBord.sub': 'SIGEPP-DPE · Vue exécutive consolidée · KPIs portefeuille DPE SENELEC',
  'route.portefeuille.label': 'Portefeuille & Projets — Vue Portefeuille',
  'route.portefeuille.sub': 'Hiérarchie Portefeuille › Programme › Projet › Lot · Gouvernance multi-niveaux',
  'route.programmes.label': 'Portefeuille & Projets — Programmes',
  'route.programmes.sub': 'Programmes DPE · Pilotage multi-projets · Consolidation budgétaire par domaine',
  'route.projets.label': 'Portefeuille & Projets — Mes Projets',
  'route.projets.sub': 'SIGEPP-DPE · Création · Planification · Pilotage · Clôture',
  'route.cockpitProjet.label': 'Portefeuille & Projets — Cockpit Projet',
  'route.cockpitProjet.sub': 'Planification hebdomadaire · Tâches · Finances · Ressources · GED · Risques',
  'route.terrain.label': 'Exécution & Contrôle — Avancement Terrain',
  'route.terrain.sub': 'Constats · Formulaires géolocalisés · Photos GPS · Synchronisation offline',
  'route.taches.label': 'Tâches, Jalons & Timesheets',
  'route.taches.sub': 'Planification opérationnelle · Dépendances · Avancement · Feuilles de temps',
  'route.budget.label': 'Budget, Engagements & Finances',
  'route.budget.sub': 'Enveloppes · Engagements · Factures · Workflow validation · Rapprochement ERP',
  'route.courriers.label': 'Courriers & Circuits de Validation',
  'route.courriers.sub': 'Registre entrant/sortant · Parapheurs · Visa documentaire · Archivage',
  'route.analytique.label': 'Transverses — Analytique & BI',
  'route.analytique.sub': 'KPIs métier · Tableaux de bord BI · Performance énergétique · S-Curves',
  'route.cartographie.label': 'Exécution & Contrôle — Cartographie SIG',
  'route.cartographie.sub': 'ArcGIS Enterprise · Projets géoréférencés · Couches réseau HTA/BT · Formulaires terrain',
  'route.workflows.label': 'Transverses — Parapheur & Validations',
  'route.workflows.sub': 'Circuits BPM · Validations en file · Délais opposables · Historique des décisions',
  'route.administration.label': 'Paramétrage — Utilisateurs & Rôles',
  'route.administration.sub': 'Multi-tenant · RBAC · Modèles projet · Champs personnalisés · Workflows configurables',
  'route.suiviEvaluation.label': 'Portefeuille & Projets — Suivi-Évaluation',
  'route.suiviEvaluation.sub': 'Indicateurs PAD · Résultats bailleurs · ANO · Rapports périodiques · Conformité livrables',
  'route.odm.label': 'Logistique & Ressources — Ordres de Mission',
  'route.odm.sub': 'Demandes ODM · Validation · Itinéraires · Carburant · Rapprochement dépenses',
  'route.flotte.label': 'Logistique & Ressources — Flotte & Chauffeurs',
  'route.flotte.sub': 'Parc automobile · Carnet de bord · Maintenance · Alertes · Coûts exploitation',
  'route.receptions.label': 'Finances & Engagements — Réceptions & Paiements',
  'route.receptions.sub': 'PV provisoires/définitifs · Levée de réserves · Immobilisations · Clôture projet',
  'route.marches.label': 'Finances & Engagements — Contrats & Marchés',
  'route.marches.sub': 'BOQ · Avenants · Situations · Pénalités · Garanties · Registre fournisseurs',
  'route.gantt.label': 'Portefeuille & Projets — Planning / Gantt',
  'route.gantt.sub': 'Chronogramme · Chemin critique · Baselines multiples · Lissage ressources · What-if',
  'route.studioRapports.label': 'Transverses — Studio de Rapports',
  'route.studioRapports.sub': 'Rapport composable · Sections libres · PDF · Export · Modèles direction & bailleurs',
  'route.reporting.label': 'Transverses — Reporting & Exports',
  'route.reporting.sub': 'Tableaux de synthèse · Exports Excel · Rapports bailleurs · Fiches PTBA',
  'route.rh.label': 'Logistique & Ressources — Ressources Humaines',
  'route.rh.sub': 'Catalogue ressources · Affectations · Timesheets · Surallocation · Habilitations',
  'route.wbs.label': 'Portefeuille & Projets — Structure WBS',
  'route.wbs.sub': 'Structure de découpage · Lots · Livrables · Matrices de responsabilité projet',
  'route.evm.label': 'Finances & Engagements — Valeur Acquise EVM',
  'route.evm.sub': 'BCWS/BCWP/ACWP · CPI · SPI · Courbe en S · EAC · ETC · Projections terminaison',
  'route.risques.label': 'Exécution & Contrôle — Risques & QHSE',
  'route.risques.sub': 'Registre risques · Matrice P×I · Plans mitigation · Incidents terrain · Audit trail',
  'route.ged.label': 'Transverses — GED & Recherche',
  'route.ged.sub': 'Gestion documentaire · Versioning · OCR · Recherche plein texte · Records management',
  'route.agentsIa.label': 'Transverses — Agents IA de rôle',
  'route.agentsIa.sub': 'RAG documentaire · Synthèses automatiques · Détection anomalies · Recommandations supervisées',
  'route.dashboardBuilder.label': 'Paramétrage — Vue personnalisée',
  'route.dashboardBuilder.sub': 'Widgets configurables · Sauvegarde par profil · Données temps réel store',

  'sidebar.accueil': 'Accueil',
  'sidebar.portefeuilleProjets': 'Portefeuille & Projets',
  'sidebar.executionControle': 'Exécution & Contrôle',
  'sidebar.financesEngagements': 'Finances & Engagements',
  'sidebar.logistiqueRessources': 'Logistique & Ressources',
  'sidebar.transverses': 'Transverses',

  'lang.fr': 'Français',
  'lang.en': 'English',
};

const EN: Record<TranslationKey, string> = {
  'app.title': 'SIGEPP — DPE',
  'app.subtitle': 'Integrated Project & Program Management System',
  'nav.home': 'Home',
  'nav.dashboard': 'Dashboard',
  'nav.portfolio': 'Portfolio',
  'nav.projects': 'Projects',
  'nav.myProjects': 'My Projects',
  'nav.planning': 'Planning',
  'nav.gantt': 'Gantt',
  'nav.wbs': 'WBS',
  'nav.tasks': 'Tasks',
  'nav.execution': 'Execution',
  'nav.terrain': 'Field',
  'nav.risks': 'Risks',
  'nav.map': 'Mapping',
  'nav.finances': 'Finance',
  'nav.budget': 'Budget',
  'nav.evm': 'EVM',
  'nav.markets': 'Procurement',
  'nav.logistics': 'Logistics',
  'nav.fleet': 'Fleet',
  'nav.odm': 'ODM',
  'nav.transverses': 'Transverses',
  'nav.ged': 'EDM',
  'nav.courriers': 'Mail',
  'nav.reporting': 'Reporting',
  'nav.workflows': 'Workflows',
  'nav.aiAgents': 'AI Agents',
  'nav.indicatorBuilder': 'Indicator Builder',
  'nav.assets': 'Fixed Assets & Depreciation',
  'nav.administration': 'Administration',
  'nav.parameters': 'Settings',
  'nav.logout': 'Logout',

  'auth.login': 'Login',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.signIn': 'Sign in',
  'auth.welcome': 'Welcome to SIGEPP-DPE',
  'auth.demoAccounts': 'Quick accounts',
  'auth.allPersonnel': 'DPE personnel available',
  'auth.admin': 'Administrator',
  'auth.role': 'Role',

  'kpi.projects': 'Projects',
  'kpi.budget': 'Budget',
  'kpi.progress': 'Progress',
  'kpi.delayed': 'Delayed',
  'kpi.alerts': 'Alerts',
  'kpi.performance': 'Performance',
  'dashboard.portfolioView': 'Portfolio View',
  'dashboard.myView': 'My View',
  'dashboard.arbitrages': 'Arbitrations',
  'dashboard.curveS': 'S-Curve',

  'project.name': 'Project name',
  'project.code': 'Code',
  'project.status': 'Status',
  'project.domain': 'Domain',
  'project.budget': 'Budget',
  'project.engaged': 'Committed',
  'project.spent': 'Disbursed',
  'project.startDate': 'Start date',
  'project.endDate': 'Planned end',
  'project.manager': 'Project manager',
  'project.priority': 'Priority',
  'project.advancement': 'Advancement',
  'project.new': 'New project',
  'project.edit': 'Edit project',
  'project.delete': 'Delete project',

  'generic.search': 'Search',
  'generic.filter': 'Filter',
  'generic.export': 'Export',
  'generic.save': 'Save',
  'generic.cancel': 'Cancel',
  'generic.confirm': 'Confirm',
  'generic.close': 'Close',
  'generic.add': 'Add',
  'generic.edit': 'Edit',
  'generic.delete': 'Delete',
  'generic.view': 'View',
  'generic.back': 'Back',
  'generic.loading': 'Loading...',
  'generic.error': 'Error',
  'generic.success': 'Success',
  'generic.empty': 'No data',
  'generic.yes': 'Yes',
  'generic.no': 'No',
  'generic.ok': 'OK',

  'org.dpe': 'DPE',
  'org.dep': 'DEP — Production',
  'org.der': 'DER — Networks',
  'org.dgc': 'DGC — Civil Engineering',
  'org.dit': 'DIT — Innovation',
  'org.cc26': 'CC26 — Compact 2026',
  'org.cpbmue': 'CPBM-UE',
  'org.cpaderau': 'CPADERAU',
  'org.cpamacel': 'CPAMACEL & EE',
  'org.dpt': 'DPT — Transport',
  'org.dpd': 'DPD — Distribution',
  'org.direction': 'Direction',
  'org.department': 'Department',
  'org.unit': 'Unit',

  'migration.title': 'Intelligent Project Migration',
  'migration.upload': 'Upload documents',
  'migration.analyze': 'AI Analysis',
  'migration.validate': 'Human validation',
  'migration.generate': 'SIGEPP Generation',
  'migration.step1': 'Step 1 — Upload',
  'migration.step2': 'Step 2 — AI Analysis',
  'migration.step3': 'Step 3 — Build',
  'migration.step4': 'Step 4 — Validation',
  'migration.step5': 'Step 5 — Finalize',
  'migration.dropFiles': 'Drop your documents here',
  'migration.documents': 'Documents',
  'migration.contracts': 'Contracts',
  'migration.reports': 'Reports',
  'migration.pv': 'Minutes',
  'migration.plans': 'Plans',

  'flex.addColumn': 'Add column',
  'flex.addRow': 'Add row',
  'flex.addItem': 'Add item',
  'flex.configure': 'Configure',
  'flex.customField': 'Custom field',
  'flex.saveView': 'Save view',
  'flex.loadView': 'Load view',

  'route.tableauDeBord.label': 'Home — Executive Cockpit / PMO',
  'route.tableauDeBord.sub': 'SIGEPP-DPE · Consolidated executive view · DPE SENELEC portfolio KPIs',
  'route.portefeuille.label': 'Portfolio & Projects — Portfolio View',
  'route.portefeuille.sub': 'Portfolio › Programme › Project › Lot hierarchy · Multi-level governance',
  'route.programmes.label': 'Portfolio & Projects — Programmes',
  'route.programmes.sub': 'DPE Programmes · Multi-project steering · Budget consolidation by domain',
  'route.projets.label': 'Portfolio & Projects — My Projects',
  'route.projets.sub': 'SIGEPP-DPE · Creation · Planning · Steering · Closure',
  'route.cockpitProjet.label': 'Portfolio & Projects — Project Cockpit',
  'route.cockpitProjet.sub': 'Weekly planning · Tasks · Finances · Resources · EDM · Risks',
  'route.terrain.label': 'Execution & Control — Field Progress',
  'route.terrain.sub': 'Site reports · Geolocated forms · GPS photos · Offline sync',
  'route.taches.label': 'Tasks, Milestones & Timesheets',
  'route.taches.sub': 'Operational planning · Dependencies · Progress · Timesheets',
  'route.budget.label': 'Budget, Commitments & Finance',
  'route.budget.sub': 'Envelopes · Commitments · Invoices · Validation workflow · ERP reconciliation',
  'route.courriers.label': 'Mail & Validation Circuits',
  'route.courriers.sub': 'In/out register · Approval workflows · Document countersigning · Archiving',
  'route.analytique.label': 'Cross-cutting — Analytics & BI',
  'route.analytique.sub': 'Business KPIs · BI dashboards · Energy performance · S-Curves',
  'route.cartographie.label': 'Execution & Control — GIS Mapping',
  'route.cartographie.sub': 'ArcGIS Enterprise · Georeferenced projects · HTA/BT network layers · Field forms',
  'route.workflows.label': 'Cross-cutting — Approval & Sign-off',
  'route.workflows.sub': 'BPM circuits · Queue validations · Enforceable deadlines · Decision history',
  'route.administration.label': 'Settings — Users & Roles',
  'route.administration.sub': 'Multi-tenant · RBAC · Project templates · Custom fields · Configurable workflows',
  'route.suiviEvaluation.label': 'Portfolio & Projects — Monitoring & Evaluation',
  'route.suiviEvaluation.sub': 'PAD indicators · Donor results · ANO · Periodic reports · Deliverable compliance',
  'route.odm.label': 'Logistics & Resources — Mission Orders',
  'route.odm.sub': 'ODM requests · Validation · Routes · Fuel · Expense reconciliation',
  'route.flotte.label': 'Logistics & Resources — Fleet & Drivers',
  'route.flotte.sub': 'Vehicle fleet · Logbook · Maintenance · Alerts · Operating costs',
  'route.receptions.label': 'Finance & Commitments — Receptions & Payments',
  'route.receptions.sub': 'Provisional/final acceptance certificates · Reserve clearance · Fixed assets · Project closure',
  'route.marches.label': 'Finance & Commitments — Contracts & Procurement',
  'route.marches.sub': 'BOQ · Amendments · Situations · Penalties · Guarantees · Supplier register',
  'route.gantt.label': 'Portfolio & Projects — Planning / Gantt',
  'route.gantt.sub': 'Timeline · Critical path · Multiple baselines · Resource smoothing · What-if',
  'route.studioRapports.label': 'Cross-cutting — Report Studio',
  'route.studioRapports.sub': 'Composable reports · Free sections · PDF · Export · Management & donor templates',
  'route.reporting.label': 'Cross-cutting — Reporting & Exports',
  'route.reporting.sub': 'Summary tables · Excel exports · Donor reports · PTBA sheets',
  'route.rh.label': 'Logistics & Resources — Human Resources',
  'route.rh.sub': 'Resource catalog · Assignments · Timesheets · Overallocation · Certifications',
  'route.wbs.label': 'Portfolio & Projects — WBS Structure',
  'route.wbs.sub': 'Work breakdown · Lots · Deliverables · Project responsibility matrices',
  'route.evm.label': 'Finance & Commitments — Earned Value EVM',
  'route.evm.sub': 'BCWS/BCWP/ACWP · CPI · SPI · S-Curve · EAC · ETC · Termination projections',
  'route.risques.label': 'Execution & Control — Risks & QHSE',
  'route.risques.sub': 'Risk register · P×I matrix · Mitigation plans · Field incidents · Audit trail',
  'route.ged.label': 'Cross-cutting — EDM & Search',
  'route.ged.sub': 'Document management · Versioning · OCR · Full-text search · Records management',
  'route.agentsIa.label': 'Cross-cutting — Role-based AI Agents',
  'route.agentsIa.sub': 'Document RAG · Auto summaries · Anomaly detection · Supervised recommendations',
  'route.dashboardBuilder.label': 'Settings — Custom View',
  'route.dashboardBuilder.sub': 'Configurable widgets · Profile-based save · Real-time store data',

  'sidebar.accueil': 'Home',
  'sidebar.portefeuilleProjets': 'Portfolio & Projects',
  'sidebar.executionControle': 'Execution & Control',
  'sidebar.financesEngagements': 'Finance & Commitments',
  'sidebar.logistiqueRessources': 'Logistics & Resources',
  'sidebar.transverses': 'Cross-cutting',

  'lang.fr': 'Français',
  'lang.en': 'English',
};

export const TRANSLATIONS: Record<Lang, Record<TranslationKey, string>> = { fr: FR, en: EN };
export const DEFAULT_LANG: Lang = 'fr';
