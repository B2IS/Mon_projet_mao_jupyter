-- ============================================================================
-- SIGEPP-DPE — Row-Level Security (PostgreSQL) — défense en profondeur
-- ----------------------------------------------------------------------------
-- À exécuter APRÈS `prisma migrate` :  psql "$DATABASE_URL" -f prisma/rls/enable_rls.sql
--
-- Principe : tout objet métier porte une colonne orgPath. La RLS garantit, AU NIVEAU
-- BASE, qu'une session ne lit/écrit que les lignes de son périmètre — même si le code
-- applicatif est contourné. Le périmètre est passé via le GUC `app.org_paths`
-- (liste de chemins visibles, séparés par des virgules), positionné par requête :
--     SET app.org_paths = 'DPE.DER.DPT';            -- Chef Projet DPT
--     SET app.is_consolidated = 'on';               -- DPE / CSE (PMO Central)
-- ============================================================================

-- Fonction de décision : un orgPath est-il visible pour la session courante ?
-- Règle ABSOLUE : égalité exacte OU sous-unité (frontière '.') — jamais un préfixe nu.
CREATE OR REPLACE FUNCTION can_see_path(p_org_path text)
RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE
  v_consolidated text := current_setting('app.is_consolidated', true);
  v_paths        text := current_setting('app.org_paths', true);
  v_p            text;
BEGIN
  IF v_consolidated = 'on' THEN
    RETURN true;                                   -- DPE / CSE → tout
  END IF;
  IF v_paths IS NULL OR v_paths = '' THEN
    RETURN false;                                  -- aucune session = aucun accès
  END IF;
  FOREACH v_p IN ARRAY string_to_array(v_paths, ',') LOOP
    v_p := btrim(v_p);
    IF p_org_path = v_p OR p_org_path LIKE v_p || '.%' THEN
      RETURN true;
    END IF;
  END LOOP;
  RETURN false;
END;
$$;

-- Active la RLS + politique d'isolation sur chaque table portant orgPath.
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'Projet','Marche','AttachementPaiement','Budget','Decaissement','Immobilisation',
    'Mission','Vehicule','Pointage','Reservation','Document','Site','Kpi','Risque',
    'WorkflowInstance','Delegation','FormDef','DashboardDef','ReportDef'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE "%s" ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE "%s" FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format($f$
      DROP POLICY IF EXISTS org_isolation ON "%1$s";
      CREATE POLICY org_isolation ON "%1$s"
        USING (can_see_path("orgPath"))
        WITH CHECK (can_see_path("orgPath"));
    $f$, t);
  END LOOP;
END;
$$;

-- KPI consolidés : visibles uniquement quand la session est consolidée (DPE/CSE).
DROP POLICY IF EXISTS org_isolation ON "Kpi";
CREATE POLICY org_isolation ON "Kpi"
  USING ( can_see_path("orgPath") AND ("consolide" = false OR current_setting('app.is_consolidated', true) = 'on') )
  WITH CHECK ( can_see_path("orgPath") );

-- Audit append-only : INSERT autorisé, UPDATE/DELETE révoqués (journal immuable).
ALTER TABLE "AuditLog" ENABLE ROW LEVEL SECURITY;
REVOKE UPDATE, DELETE ON "AuditLog" FROM PUBLIC;

-- Vérification rapide (à lancer en session de test) :
--   SET app.org_paths = 'DPE.DER.DPT';
--   SELECT count(*) FROM "Projet";   -- ne renvoie QUE les projets DPT
