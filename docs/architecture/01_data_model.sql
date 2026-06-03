-- =====================================================================
-- SIGEPP-DPE — MODÈLE DE DONNÉES POSTGRESQL (Organization-Driven)
-- Livrable Master Prompt : Modèle de données + Sécurité ABAC (RLS)
-- L'ORGANISATION est le référentiel maître ; tous les objets métier en héritent.
-- Cible : PostgreSQL 15+. Compatible NestJS/DDD/CQRS + Keycloak (IAM).
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE SCHEMA IF NOT EXISTS sigepp;
SET search_path = sigepp, public;

-- =====================================================================
-- 1. RÉFÉRENTIEL ORGANISATIONNEL (cœur du système)
--    Hiérarchie : DPE > Direction > Département > Service ; + Cellules/Programmes.
--    org_unit.path (ltree-like) matérialise la hiérarchie pour la sécurité.
-- =====================================================================
CREATE TYPE org_type AS ENUM ('DPE','DIRECTION','DEPARTEMENT','SERVICE','CELLULE','PROGRAMME','UAGL');

CREATE TABLE org_unit (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          TEXT UNIQUE NOT NULL,           -- 'DER', 'DPT', 'DGC_SIG', 'CC26'
  label         TEXT NOT NULL,
  type          org_type NOT NULL,
  parent_id     UUID REFERENCES org_unit(id),
  -- chemin matérialisé (ex: 'DPE.DER.DPT') → requêtes de sous-arborescence rapides
  path          TEXT NOT NULL,
  is_programme  BOOLEAN NOT NULL DEFAULT FALSE, -- CPBM-UE, CC26, PAMACEL, PADERAU
  domaines      TEXT[] NOT NULL DEFAULT '{}',   -- ['production','solaire',...]
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_org_unit_path   ON org_unit (path text_pattern_ops);
CREATE INDEX idx_org_unit_parent ON org_unit (parent_id);

-- Données de référence (extrait — structure officielle DPE)
INSERT INTO org_unit (code,label,type,parent_id,path,is_programme,domaines) VALUES
 ('DPE','Direction Principale Équipement','DPE',NULL,'DPE',false,'{*}'),
 ('CSE','Cellule Suivi-Évaluation (PMO Central)','CELLULE',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.CSE',false,'{*}'),
 ('DEP','Direction Équipement Production','DIRECTION',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.DEP',false,'{production,thermique,solaire,eolien,biomasse,hydrogene}'),
 ('DER','Direction Équipement Réseaux','DIRECTION',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.DER',false,'{transport,distribution,lignes_ht,hta,bt,postes}'),
 ('DGC','Direction Génie Civil','DIRECTION',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.DGC',false,'{genie_civil,sig,immobilisation,patrimoine}'),
 ('DIT','Direction Innovation Technologique','DIRECTION',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.DIT',false,'{smartgrid,stockage,teleconduite,commercial,digital}'),
 ('CPBM_UE','Coordination Programmes BM-UE','PROGRAMME',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.CPBM_UE',true,'{*}'),
 ('CC26','Coordination Compact 2026','PROGRAMME',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.CC26',true,'{*}'),
 ('PAMACEL','Cellule PAMACEL & Efficacité Énergétique','PROGRAMME',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.PAMACEL',true,'{*}'),
 ('PADERAU','Cellule PADERAU','PROGRAMME',(SELECT id FROM org_unit WHERE code='DPE'),'DPE.PADERAU',true,'{*}');
-- Départements
INSERT INTO org_unit (code,label,type,parent_id,path,domaines) VALUES
 ('DEP_PEC','Dépt Projets Énergies Conventionnelles','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DEP'),'DPE.DEP.DEP_PEC','{production,thermique,charbon,fuel,gaz}'),
 ('DEP_PER','Dépt Projets Énergies Renouvelables','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DEP'),'DPE.DEP.DEP_PER','{production,solaire,eolien,biomasse}'),
 ('DPT','Dépt Projets Transport','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DER'),'DPE.DER.DPT','{transport,lignes_ht,postes,interconnexion}'),
 ('DPD','Dépt Projets Distribution','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DER'),'DPE.DER.DPD','{distribution,hta,bt,branchements,electrification}'),
 ('DGC_INV','Dépt Projets Investissement Génie Civil','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DGC'),'DPE.DGC.DGC_INV','{genie_civil,travaux,ouvrages}'),
 ('DGC_EGI','Dépt Études Géographiques & Immobilisations','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DGC'),'DPE.DGC.DGC_EGI','{sig,immobilisation,patrimoine}'),
 ('DIT_SG','Dépt Smart Grid & Stockage','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DIT'),'DPE.DIT.DIT_SG','{smartgrid,stockage,teleconduite}'),
 ('DIT_COM','Dépt Projets Commercial','DEPARTEMENT',(SELECT id FROM org_unit WHERE code='DIT'),'DPE.DIT.DIT_COM','{commercial,digital,facturation}');
-- Services (DGC/EGI)
INSERT INTO org_unit (code,label,type,parent_id,path,domaines) VALUES
 ('DGC_SIG','Service SIG','SERVICE',(SELECT id FROM org_unit WHERE code='DGC_EGI'),'DPE.DGC.DGC_EGI.DGC_SIG','{sig,cartographie}'),
 ('DGC_IMMO','Service Immobilisations','SERVICE',(SELECT id FROM org_unit WHERE code='DGC_EGI'),'DPE.DGC.DGC_EGI.DGC_IMMO','{immobilisation,patrimoine}');

-- =====================================================================
-- 2. RÉFÉRENTIEL RH — les permissions sont CALCULÉES, jamais saisies.
-- =====================================================================
CREATE TABLE poste (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
  niveau_fonctionnel INT NOT NULL DEFAULT 3  -- 0 exécutif … 3 agent
);

CREATE TABLE app_user (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  matricule     TEXT UNIQUE NOT NULL,
  prenom        TEXT NOT NULL, nom TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  keycloak_sub  TEXT UNIQUE,                  -- lien IAM (Keycloak)
  poste_id      UUID REFERENCES poste(id),
  fonction      TEXT,
  -- rattachement principal (l'unité d'affectation porte la sécurité)
  org_unit_id   UUID NOT NULL REFERENCES org_unit(id),
  superieur_id  UUID REFERENCES app_user(id),
  niveau_hierarchique INT NOT NULL DEFAULT 3, -- 0 DPE/PMO … 3 agent
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Affectations MULTIPLES (un agent peut servir plusieurs unités/programmes)
CREATE TABLE user_affectation (
  user_id     UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  org_unit_id UUID NOT NULL REFERENCES org_unit(id),
  role_code   TEXT NOT NULL,                  -- 'CHEF_PROJ','EXPERT_SE','UAGL',...
  PRIMARY KEY (user_id, org_unit_id, role_code)
);

-- =====================================================================
-- 3. MOTEUR D'ACCÈS — fonction qui calcule les unités visibles d'un user.
--    Règle absolue : son unité + ses SOUS-unités ; jamais les unités parallèles.
--    Exception : DPE/PMO Central (CSE) = tout ; un Programme voit son périmètre.
-- =====================================================================
CREATE OR REPLACE FUNCTION visible_org_paths(p_user UUID)
RETURNS TABLE(path TEXT) LANGUAGE sql STABLE AS $$
  WITH me AS (
    SELECT o.code, o.path, o.type
    FROM app_user u JOIN org_unit o ON o.id = u.org_unit_id
    WHERE u.id = p_user
  )
  -- DPE / CSE (PMO central) → tout le référentiel
  SELECT o.path FROM org_unit o, me
   WHERE me.code IN ('DPE','CSE')
  UNION
  -- sinon : mon unité + toutes mes sous-unités (préfixe de path)
  SELECT o.path FROM org_unit o, me
   WHERE me.code NOT IN ('DPE','CSE')
     AND (o.path = me.path OR o.path LIKE me.path || '.%')
  UNION
  -- + unités atteintes par mes affectations secondaires (et leurs sous-unités)
  SELECT o.path FROM org_unit o
   JOIN user_affectation a ON a.user_id = p_user
   JOIN org_unit base ON base.id = a.org_unit_id
   WHERE o.path = base.path OR o.path LIKE base.path || '.%';
$$;

-- =====================================================================
-- 4. OBJETS MÉTIER — tous rattachés à l'organisation (multi-rattachement).
-- =====================================================================
CREATE TABLE programme (   -- CPBM-UE, CC26, PADERAU… (alias org_unit is_programme)
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, label TEXT NOT NULL,
  bailleur TEXT, org_unit_id UUID REFERENCES org_unit(id)
);

CREATE TABLE projet (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code_bit      TEXT,                          -- code BIT = référence officielle
  nom           TEXT NOT NULL,
  domaine       TEXT NOT NULL,
  -- MULTI-RATTACHEMENT (prompt) : Direction + Département + Programme + Bailleur + Zone
  direction_id  UUID NOT NULL REFERENCES org_unit(id),
  departement_id UUID REFERENCES org_unit(id),
  programme_id  UUID REFERENCES programme(id),
  bailleur      TEXT,
  zone          TEXT,                          -- région / localisation
  -- héritage sécurité : path de l'unité propriétaire, dénormalisé pour RLS
  org_path      TEXT NOT NULL,
  chef_projet_id UUID REFERENCES app_user(id),
  controleur_id  UUID REFERENCES app_user(id),
  expert_se_id   UUID REFERENCES app_user(id),
  budget_mfcfa  NUMERIC(14,2) NOT NULL DEFAULT 0,
  decaisse_mfcfa NUMERIC(14,2) NOT NULL DEFAULT 0,
  avancement    INT NOT NULL DEFAULT 0,
  cpi NUMERIC(5,2), spi NUMERIC(5,2),
  statut        TEXT NOT NULL DEFAULT 'en_cours',
  -- consolidation multi-lots : lot_parent référence le projet parent
  lot_parent_id UUID REFERENCES projet(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_projet_orgpath ON projet (org_path text_pattern_ops);

-- Tâches / WBS, ressources, affectations (planning type MS Project)
CREATE TABLE tache (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet_id UUID NOT NULL REFERENCES projet(id) ON DELETE CASCADE,
  wbs TEXT, nom TEXT NOT NULL, duree INT, date_debut DATE, date_fin DATE,
  date_debut_ref DATE, date_fin_ref DATE,     -- baseline (planning de référence)
  avancement INT NOT NULL DEFAULT 0,
  predecesseur_id UUID REFERENCES tache(id),
  dep_type TEXT DEFAULT 'FS'                   -- FS/SS/FF/SF
);
CREATE TABLE ressource (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom TEXT NOT NULL, type TEXT NOT NULL, taux_horaire NUMERIC, org_unit_id UUID REFERENCES org_unit(id)
);
CREATE TABLE affectation (
  tache_id UUID REFERENCES tache(id) ON DELETE CASCADE,
  ressource_id UUID REFERENCES ressource(id),
  allocation INT NOT NULL DEFAULT 100,
  PRIMARY KEY (tache_id, ressource_id)
);

-- Marchés / contrats / factures / décomptes / attachements (BOQ réalisé)
CREATE TABLE marche (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet_id UUID NOT NULL REFERENCES projet(id), org_path TEXT NOT NULL,
  numero TEXT, objet TEXT, attributaire TEXT, montant NUMERIC, statut TEXT
);
CREATE TABLE attachement_paiement (   -- entreprise soumet quantités réalisées → CP valide
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  projet_id UUID NOT NULL REFERENCES projet(id), org_path TEXT NOT NULL,
  numero INT, periode TEXT, entreprise TEXT,
  statut TEXT NOT NULL DEFAULT 'soumis',       -- soumis/valide/rejete
  montant NUMERIC, valide_par UUID REFERENCES app_user(id)
);
CREATE TABLE attachement_ligne (
  attachement_id UUID REFERENCES attachement_paiement(id) ON DELETE CASCADE,
  designation TEXT, unite TEXT, prix_unitaire NUMERIC,
  qte_contractuelle NUMERIC, qte_realisee NUMERIC, qte_validee NUMERIC
);

-- KPI sécurisés (chaque KPI porte ses dimensions org — filtrage automatique)
CREATE TABLE kpi (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT, libelle TEXT, valeur NUMERIC, cible NUMERIC, unite TEXT,
  direction_id UUID REFERENCES org_unit(id), departement_id UUID REFERENCES org_unit(id),
  programme_id UUID REFERENCES programme(id), bailleur TEXT, zone TEXT,
  org_path TEXT NOT NULL,                       -- héritage sécurité
  consolide_dpe BOOLEAN NOT NULL DEFAULT FALSE  -- réservé Directeur DPE + PMO Central
);

-- Risque, immobilisation, document, mission, workflow — tous avec org_path hérité
CREATE TABLE risque        (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), projet_id UUID REFERENCES projet(id), org_path TEXT NOT NULL, description TEXT, probabilite INT, impact INT, statut TEXT);
CREATE TABLE immobilisation (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), projet_id UUID REFERENCES projet(id), org_path TEXT NOT NULL, designation TEXT, valeur NUMERIC, duree_amort INT);
CREATE TABLE document      (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), projet_id UUID REFERENCES projet(id), org_path TEXT NOT NULL, nom TEXT, categorie TEXT, minio_key TEXT);
CREATE TABLE mission       (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), org_path TEXT NOT NULL, objet TEXT, agent_id UUID REFERENCES app_user(id), date_depart DATE, date_retour DATE, statut TEXT);

-- Workflow (instances Camunda + définitions versionnées)
CREATE TABLE workflow_def (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cle TEXT NOT NULL, version INT NOT NULL DEFAULT 1, bpmn_xml TEXT,
  actif BOOLEAN NOT NULL DEFAULT TRUE, UNIQUE(cle,version)
);
CREATE TABLE workflow_instance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  workflow_def_id UUID REFERENCES workflow_def(id),
  objet_type TEXT, objet_id UUID, org_path TEXT NOT NULL,
  etape_courante TEXT, statut TEXT, camunda_process_id TEXT
);

-- Journal d'audit immuable (append-only)
CREATE TABLE audit_log (
  id BIGSERIAL PRIMARY KEY,
  ts TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_id UUID, action TEXT NOT NULL, objet_type TEXT, objet_id UUID,
  org_path TEXT, details JSONB
);
REVOKE UPDATE, DELETE ON audit_log FROM PUBLIC; -- immuabilité

-- =====================================================================
-- 5. SÉCURITÉ ABAC — Row-Level Security (RLS).
--    L'app fixe le user courant : SET sigepp.current_user_id = '<uuid>';
--    Tout objet portant org_path n'est visible que si son path appartient
--    aux chemins visibles de l'utilisateur (héritage automatique de sécurité).
-- =====================================================================
CREATE OR REPLACE FUNCTION current_app_user() RETURNS UUID LANGUAGE sql STABLE AS $$
  SELECT NULLIF(current_setting('sigepp.current_user_id', true), '')::uuid;
$$;

CREATE OR REPLACE FUNCTION can_see_path(p_path TEXT) RETURNS BOOLEAN LANGUAGE sql STABLE AS $$
  SELECT EXISTS (SELECT 1 FROM visible_org_paths(current_app_user()) v WHERE p_path LIKE v.path || '%');
$$;

DO $$DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['projet','marche','attachement_paiement','kpi','risque','immobilisation','document','mission','workflow_instance']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('CREATE POLICY org_isolation ON %I USING (can_see_path(org_path));', t);
  END LOOP;
END$$;

-- KPI consolidés DPE : réservés Directeur DPE + PMO Central (CSE).
CREATE POLICY kpi_consolide ON kpi USING (
  NOT consolide_dpe
  OR EXISTS (SELECT 1 FROM app_user u JOIN org_unit o ON o.id=u.org_unit_id
             WHERE u.id=current_app_user() AND o.code IN ('DPE','CSE'))
);

-- =====================================================================
-- Vue de contrôle : ce que voit l'utilisateur courant (debug/audit).
-- =====================================================================
CREATE VIEW v_mon_perimetre AS
  SELECT o.code, o.label, o.type FROM org_unit o
  WHERE can_see_path(o.path) ORDER BY o.path;
