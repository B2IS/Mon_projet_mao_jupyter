/**
 * translations.ts — Dictionnaires de traduction SIGEP-DPE
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
  | 'route.springboard.label' | 'route.springboard.sub'
  | 'route.gestionTemps.label' | 'route.gestionTemps.sub'
  | 'route.etudes.label' | 'route.etudes.sub'
  | 'route.recolement.label' | 'route.recolement.sub'
  | 'route.miseEnService.label' | 'route.miseEnService.sub'
  | 'route.gestionProjet.label' | 'route.gestionProjet.sub'
  | 'route.migration.label' | 'route.migration.sub'
  | 'route.immobilisations.label' | 'route.immobilisations.sub'
  | 'route.structuration.label' | 'route.structuration.sub'

  // Sidebar sections
  | 'sidebar.accueil' | 'sidebar.portefeuilleProjets' | 'sidebar.executionControle'
  | 'sidebar.financesEngagements' | 'sidebar.logistiqueRessources' | 'sidebar.transverses'

  | 'lang.fr' | 'lang.en';

const FR: Record<TranslationKey, string> = {
  'app.title': 'SIGEP — DPE',
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
  'auth.welcome': 'Bienvenue sur SIGEP-DPE',
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
  'migration.generate': 'Génération SIGEP',
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

  'route.tableauDeBord.label': 'Tableau de Bord',
  'route.tableauDeBord.sub': 'Vue exécutive consolidée · KPIs portefeuille DPE',
  'route.portefeuille.label': 'Portefeuille DPE',
  'route.portefeuille.sub': 'Portefeuille › Programme › Projet · Gouvernance multi-niveaux',
  'route.programmes.label': 'Programmes',
  'route.programmes.sub': 'Pilotage multi-projets · Consolidation budgétaire par domaine',
  'route.projets.label': 'Mes Projets',
  'route.projets.sub': 'Création · Planification · Pilotage · Clôture',
  'route.cockpitProjet.label': 'Cockpit Projet',
  'route.cockpitProjet.sub': 'Tâches · Finances · Ressources · GED · Risques',
  'route.terrain.label': 'Avancement Terrain',
  'route.terrain.sub': 'Constats · Formulaires géolocalisés · Photos GPS · Offline',
  'route.taches.label': 'Tâches & Jalons',
  'route.taches.sub': 'Planification opérationnelle · Dépendances · Feuilles de temps',
  'route.budget.label': 'Budget & Finances',
  'route.budget.sub': 'Enveloppes · Engagements · Factures · Rapprochement ERP',
  'route.courriers.label': 'Courriers',
  'route.courriers.sub': 'Registre entrant/sortant · Parapheurs · Archivage documentaire',
  'route.analytique.label': 'Analytique & BI',
  'route.analytique.sub': 'KPIs métier · Tableaux de bord BI · Performance · S-Curves',
  'route.cartographie.label': 'Cartographie SIG',
  'route.cartographie.sub': 'ArcGIS Enterprise · Projets géoréférencés · Couches réseau HTA/BT',
  'route.workflows.label': 'Parapheur & Workflows',
  'route.workflows.sub': 'Circuits BPM · Validations · Délais opposables · Historique',
  'route.administration.label': 'Administration',
  'route.administration.sub': 'Multi-tenant · RBAC · Modèles projet · Champs personnalisés',
  'route.suiviEvaluation.label': 'Suivi-Évaluation',
  'route.suiviEvaluation.sub': 'Indicateurs PAD · Résultats bailleurs · ANO · Rapports périodiques',
  'route.odm.label': 'Ordres de Mission',
  'route.odm.sub': 'Demandes · Validation · Itinéraires · Carburant · Dépenses',
  'route.flotte.label': 'Flotte & Chauffeurs',
  'route.flotte.sub': 'Parc automobile · Carnet de bord · Maintenance · Coûts',
  'route.receptions.label': 'Réceptions & Paiements',
  'route.receptions.sub': 'PV provisoires/définitifs · Levée de réserves · Clôture projet',
  'route.marches.label': 'Contrats & Marchés',
  'route.marches.sub': 'BOQ · Avenants · Situations · Pénalités · Registre fournisseurs',
  'route.gantt.label': 'Planning Gantt',
  'route.gantt.sub': 'Chronogramme · Chemin critique · Baselines · Lissage ressources',
  'route.studioRapports.label': 'Studio de Rapports',
  'route.studioRapports.sub': 'Rapport composable · PDF · Export · Modèles direction & bailleurs',
  'route.reporting.label': 'Reporting & Exports',
  'route.reporting.sub': 'Tableaux de synthèse · Exports Excel · Rapports bailleurs',
  'route.rh.label': 'Ressources Humaines',
  'route.rh.sub': 'Catalogue ressources · Affectations · Timesheets · Habilitations',
  'route.wbs.label': 'Structure WBS',
  'route.wbs.sub': 'Découpage · Lots · Livrables · Matrices de responsabilité',
  'route.evm.label': 'Valeur Acquise (EVM)',
  'route.evm.sub': 'CPI · SPI · Courbe en S · EAC · ETC · Projections terminaison',
  'route.risques.label': 'Risques & QHSE',
  'route.risques.sub': 'Registre risques · Matrice P×I · Plans mitigation · Incidents',
  'route.ged.label': 'GED & Recherche',
  'route.ged.sub': 'Gestion documentaire · Versioning · OCR · Recherche plein texte',
  'route.agentsIa.label': 'Agents IA',
  'route.agentsIa.sub': 'RAG documentaire · Synthèses · Détection anomalies · Recommandations',
  'route.dashboardBuilder.label': 'Vue Personnalisée',
  'route.dashboardBuilder.sub': 'Widgets configurables · Sauvegarde par profil · Données temps réel',
  'route.springboard.label': 'Mon Espace',
  'route.springboard.sub': 'Vue d\'ensemble projets · Alertes · KPIs',
  'route.gestionTemps.label': 'Temps & Activités',
  'route.gestionTemps.sub': 'Feuille de temps · Pointage · Productivité · Heures supplémentaires',
  'route.etudes.label': 'Études & Conception',
  'route.etudes.sub': 'APS · APD · DAO · Notes techniques · EIES · DOE',
  'route.recolement.label': 'Récolement Numérique',
  'route.recolement.sub': 'As Planned → As Built · Validation conformité · Activation SIG',
  'route.miseEnService.label': 'Mise en Service',
  'route.miseEnService.sub': 'PV réception · Validation ouvrages · Activation SIG · Immobilisations',
  'route.gestionProjet.label': 'Gestion de Projet',
  'route.gestionProjet.sub': 'Exigences · Livrables · Risques · Parties prenantes · RACI',
  'route.migration.label': 'Migration Numérique',
  'route.migration.sub': 'Reconstruction automatique · SIG · Patrimoine · Immobilisations · GED',
  'route.immobilisations.label': 'Patrimoine & Actifs',
  'route.immobilisations.sub': 'Registre des actifs · Immobilisations · Amortissements · Réconciliation',
  'route.structuration.label': 'Structuration IA',
  'route.structuration.sub': 'Décomposition sous-composants · Classification · Knowledge Graph patrimonial',

  'sidebar.accueil': 'Accueil',
  'sidebar.portefeuilleProjets': 'Portefeuille & Projets',
  'sidebar.executionControle': 'Exécution & Contrôle',
  'sidebar.financesEngagements': 'Finances & Engagements',
  'sidebar.logistiqueRessources': 'Logistique & Ressources',
  'sidebar.transverses': 'Suivi, Reporting & Collaboration',

  'lang.fr': 'Français',
  'lang.en': 'English',
};

const EN: Record<TranslationKey, string> = {
  'app.title': 'SIGEP — DPE',
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
  'auth.welcome': 'Welcome to SIGEP-DPE',
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
  'migration.generate': 'SIGEP Generation',
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

  'route.tableauDeBord.label': 'Dashboard',
  'route.tableauDeBord.sub': 'Consolidated executive view · DPE portfolio KPIs',
  'route.portefeuille.label': 'DPE Portfolio',
  'route.portefeuille.sub': 'Portfolio › Programme › Project · Multi-level governance',
  'route.programmes.label': 'Programmes',
  'route.programmes.sub': 'Multi-project steering · Budget consolidation by domain',
  'route.projets.label': 'My Projects',
  'route.projets.sub': 'Creation · Planning · Steering · Closure',
  'route.cockpitProjet.label': 'Project Cockpit',
  'route.cockpitProjet.sub': 'Tasks · Finances · Resources · EDM · Risks',
  'route.terrain.label': 'Field Progress',
  'route.terrain.sub': 'Site reports · Geolocated forms · GPS photos · Offline',
  'route.taches.label': 'Tasks & Milestones',
  'route.taches.sub': 'Operational planning · Dependencies · Timesheets',
  'route.budget.label': 'Budget & Finance',
  'route.budget.sub': 'Envelopes · Commitments · Invoices · ERP reconciliation',
  'route.courriers.label': 'Mail',
  'route.courriers.sub': 'In/out register · Approval workflows · Archiving',
  'route.analytique.label': 'Analytics & BI',
  'route.analytique.sub': 'Business KPIs · BI dashboards · Energy performance',
  'route.cartographie.label': 'GIS Mapping',
  'route.cartographie.sub': 'ArcGIS Enterprise · Georeferenced projects · HTA/BT layers',
  'route.workflows.label': 'Approval & Workflows',
  'route.workflows.sub': 'BPM circuits · Queue validations · Decision history',
  'route.administration.label': 'Administration',
  'route.administration.sub': 'Multi-tenant · RBAC · Project templates · Custom fields',
  'route.suiviEvaluation.label': 'M&E',
  'route.suiviEvaluation.sub': 'PAD indicators · Donor results · Periodic reports',
  'route.odm.label': 'Mission Orders',
  'route.odm.sub': 'ODM requests · Validation · Routes · Fuel · Expenses',
  'route.flotte.label': 'Fleet & Drivers',
  'route.flotte.sub': 'Vehicle fleet · Logbook · Maintenance · Operating costs',
  'route.receptions.label': 'Receptions & Payments',
  'route.receptions.sub': 'Acceptance certificates · Reserve clearance · Project closure',
  'route.marches.label': 'Contracts & Procurement',
  'route.marches.sub': 'BOQ · Amendments · Situations · Supplier register',
  'route.gantt.label': 'Gantt Planning',
  'route.gantt.sub': 'Timeline · Critical path · Baselines · Resource smoothing',
  'route.studioRapports.label': 'Report Studio',
  'route.studioRapports.sub': 'Composable reports · PDF · Export · Management templates',
  'route.reporting.label': 'Reporting & Exports',
  'route.reporting.sub': 'Summary tables · Excel exports · Donor reports',
  'route.rh.label': 'Human Resources',
  'route.rh.sub': 'Resource catalog · Assignments · Timesheets · Certifications',
  'route.wbs.label': 'WBS Structure',
  'route.wbs.sub': 'Work breakdown · Lots · Deliverables · Responsibility matrices',
  'route.evm.label': 'Earned Value (EVM)',
  'route.evm.sub': 'CPI · SPI · S-Curve · EAC · ETC · Projections',
  'route.risques.label': 'Risks & QHSE',
  'route.risques.sub': 'Risk register · P×I matrix · Mitigation plans · Incidents',
  'route.ged.label': 'EDM & Search',
  'route.ged.sub': 'Document management · Versioning · OCR · Full-text search',
  'route.agentsIa.label': 'AI Agents',
  'route.agentsIa.sub': 'Document RAG · Auto summaries · Anomaly detection',
  'route.dashboardBuilder.label': 'Custom View',
  'route.dashboardBuilder.sub': 'Configurable widgets · Profile-based save · Real-time data',
  'route.springboard.label': 'My Workspace',
  'route.springboard.sub': 'Projects overview · Alerts · KPIs',
  'route.gestionTemps.label': 'Time & Activities',
  'route.gestionTemps.sub': 'Timesheets · Attendance · Productivity · Overtime',
  'route.etudes.label': 'Studies & Design',
  'route.etudes.sub': 'APS · APD · Tender Docs · Technical notes · EIES · DOE',
  'route.recolement.label': 'Digital As-Built',
  'route.recolement.sub': 'As Planned → As Built · Conformity validation · GIS activation',
  'route.miseEnService.label': 'Commissioning',
  'route.miseEnService.sub': 'Reception PV · Works validation · GIS activation · Fixed assets',
  'route.gestionProjet.label': 'Project Management',
  'route.gestionProjet.sub': 'Requirements · Deliverables · Risks · Stakeholders · RACI',
  'route.migration.label': 'Digital Migration',
  'route.migration.sub': 'Automatic reconstruction · GIS · Assets · DMS from existing sources',
  'route.immobilisations.label': 'Heritage & Assets',
  'route.immobilisations.sub': 'Asset register · Fixed assets · Depreciation · Accounting',
  'route.structuration.label': 'AI Structuring',
  'route.structuration.sub': 'Sub-component breakdown · Classification · Knowledge graph',

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
