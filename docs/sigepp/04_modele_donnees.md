# SIGEPP — Étape 4 : Modèle de données complet

> Évolution du schéma V1 (`docs/architecture/01_data_model.sql` + `backend-enterprise/prisma/schema.prisma`).
> Tout objet métier porte `org_path` (héritage de sécurité RLS). Ajouts SIGEPP : **EPS/OBS/CBS**,
> **Data Hub/MDM**, **Knowledge Graph**, **PostGIS**, **gouvernance & gates**, **audit immuable**.

---

## 1. Domaines & entités principales

### Organisation & RH *(référentiel maître — V1)*
`org_unit(id, code, label, type, parent_id, path, is_programme, domaines[])` ·
`poste(code, niveau_fonctionnel)` · `app_user(matricule, prenom, nom, poste_id, org_unit_id,
superieur_id, niveau_hierarchique)` · `user_affectation(user_id, org_unit_id, role_code)`.

### Gouvernance & Portefeuille *(EPS/OBS/CBS = ajout)*
```
eps_node(id, parent_id, org_path, type[PORTEFEUILLE|PROGRAMME|SOUS_PORTEFEUILLE], label)   (+)
portefeuille(id, org_path, type[STRATEGIQUE|OPERATIONNEL], horizon, enveloppe_mfcfa)        (+)
programme(id, code, org_path, bailleur, budget_mfcfa, benefices[])                          (V1)
comite(id, org_path, type, date, decisions[])                                              (+)
decision(id, comite_id, org_path, objet_type, objet_id, sens, motif, par, at)  // historisé (+)
priorisation(id, projet_id, critere_id, score, poids)  // scoring multicritère              (V1)
critere_priorisation(id, label, poids, echelle)  // configurable                            (V1)
```

### Projet & Exécution *(V1)*
`projet(id, code_bit, org_path, direction_id, departement_id, programme, bailleur, zone,
chef_projet_id, budget_mfcfa, decaisse_mfcfa, avancement, cpi, spi, statut, lot_parent_id)` ·
`obs_node(projet_id, org_unit_id, role)` *(+)* · `tache(projet_id, wbs, baseline*, cout_prevu/reel,
avancement, predecesseur_id, dep_type)` · `ressource` · `affectation(allocation)` · `jalon` ·
`risque(probabilite, impact, parade)` · `changement(projet_id, type, impact, statut)` *(+)* ·
`livrable(projet_id, type, statut, document_id)` *(+)*.

### Marchés · Finances · Immobilisations *(V1)*
`marche(org_path, numero, objet, attributaire, montant, statut)` · `avenant(marche_id, montant)` *(+)* ·
`attachement_paiement(org_path, numero, periode, entreprise, statut)` + `attachement_ligne(BOQ:
prix_unitaire, qte_contractuelle/realisee/validee)` · `reception(marche_id, pv, statut)` ·
`budget(org_path, annee, rubrique, dotation, engage, decaisse)` · `decaissement` ·
`immobilisation(org_path, designation, valeur_acquisition, date_mise_service, duree, statut)`.

### S&E · GED · GIS · UAGL *(V1 ; GED→MinIO, GIS→PostGIS)*
`kpi(org_path, code, cible, valeur, consolide)` · `cadre_logique(programme_id, niveau, indicateur)` *(+)* ·
`document(org_path, projet_id, nom, version, minio_key, ocr_text, signe)` ·
`site(org_path, projet_id, geom GEOMETRY(Point,4326))` *(PostGIS +)* ·
`mission(ODM)` · `vehicule` · `pointage` · `reservation`.

### Workflow & Audit
`workflow_def(cle, version, bpmn_xml)` · `workflow_instance(org_path, objet_type, objet_id, etape,
candidate_group)` · `phase_gate(objet_id, gate, statut, decideur, at)` *(+)* ·
`audit_log(user_id, org_path, action, objet_type, objet_id, payload, at)` **append-only** (UPDATE/DELETE révoqués).

## 2. Data Hub / MDM *(ajout — source unique de vérité)*

```
mdm_entity(id, domain, code, libelle, attributs jsonb, statut, golden boolean)  // données de référence
data_catalog(id, dataset, owner_org_path, description, classification, qualite_score)
data_lineage(id, source_dataset, target_dataset, transformation)               // traçabilité
data_quality_rule(id, dataset, regle, severite) + data_quality_result(...)
ref_value(referentiel, code, libelle, actif)   // nomenclatures (bailleurs, statuts, domaines…)
historisation: chaque entité métier → table `*_history` (SCD2 : valid_from, valid_to) (+)
```
Le Data Hub **possède** les golden records ; les modules **consomment** (pas de double saisie).

## 3. Knowledge Graph (Neo4j) *(ajout — raisonnement IA)*

Nœuds & relations projetés depuis PostgreSQL (CDC/outbox) :
```
(Organisation)-[:PILOTE]->(Portefeuille)-[:CONTIENT]->(Programme)-[:CONTIENT]->(Projet)
(Projet)-[:PASSE]->(Marché)-[:REGI_PAR]->(Contrat)-[:PRODUIT]->(Livrable)-[:DEVIENT]->(Actif)
(Actif)-[:CAPITALISE_EN]->(Immobilisation)
(Projet)-[:MESURE_PAR]->(KPI)   (Projet)-[:EXPOSE_A]->(Risque)   (Projet)-[:DOCUMENTE_PAR]->(Document)
(AppUser)-[:RESPONSABLE_DE]->(Projet)   (OrgUnit)-[:PARENT_DE]->(OrgUnit)
```
Requêtes IA typiques : *« impact d'un retard marché M sur les KPI et l'immobilisation de l'actif A »*,
*« tous les projets du périmètre de l'utilisateur U exposés au risque R »* — **filtrées par `org_path`**.

## 4. Sécurité au niveau données (défense en profondeur)

- **RLS PostgreSQL** : `can_see_path(org_path)` (frontière `.`) sur toutes les tables à `org_path`
  (`backend-enterprise/prisma/rls/enable_rls.sql`).
- **GUC de session** : `app.org_paths`, `app.is_consolidated` positionnés par requête (Keycloak sub → user).
- **API** : `AbacGuard` + `OrgScopeService.pathFilter()` (REST & GraphQL).
- **KG** : tout `MATCH` Cypher préfixé d'un filtre `WHERE n.org_path IN $visiblePaths`.

➡️ Détail SQL exécutable : `01_data_model.sql` (V1) + extensions ci-dessus. Migration Prisma + PostGIS +
projection Neo4j = chantier d'implémentation (Étape 17, module par module).
