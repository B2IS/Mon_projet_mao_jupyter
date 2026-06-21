'use client';
/**
 * canevasStore.ts — Bibliothèque de canevas documentaires SENELEC DPE
 *
 * Canevas fournis : DAPT, Fiche Projet, PV Réception, Rapport Mensuel,
 * Note de consultation, TDR, CR Réunion, Cahier des charges.
 * Chaque canevas peut être utilisé, personnalisé, ou cloné en document GED.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { nanoid } from 'nanoid';

export type CanevasCategorie =
  | 'Passation Marchés'
  | 'Suivi-Évaluation'
  | 'Réception Travaux'
  | 'Pilotage Projet'
  | 'Gouvernance DPE';

export type CanevasStatut = 'officiel' | 'perso' | 'archive';

export interface CanevasVariable {
  cle:         string;    // ex. "{{PROJET_NOM}}"
  libelle:     string;    // ex. "Nom du projet"
  exemple:     string;    // ex. "Construction ligne 225kV"
  obligatoire: boolean;
}

export interface Canevas {
  id:          string;
  nom:         string;
  categorie:   CanevasCategorie;
  statut:      CanevasStatut;
  description: string;
  reference:   string;    // ex. "CDC DPE §3.2" ou "ND SENELEC 012/2025"
  contenu:     string;    // corps du document (Markdown/texte enrichi)
  variables:   CanevasVariable[];
  dateCreation: string;
  dateMAJ:     string;
  auteur:      string;
  usageCount:  number;    // nb d'utilisations
}

// ─────────────────────────────────────────────────────────────────────────────
// Canevas officiels pré-chargés
// ─────────────────────────────────────────────────────────────────────────────

const today = new Date().toISOString().split('T')[0];

const CANEVAS_OFFICIELS: Canevas[] = [
  // ─── 1. DAPT ─────────────────────────────────────────────────────────────
  {
    id: 'cv-dapt-001',
    nom: 'DAPT — Dossier d\'Appel à la Passation de Travaux',
    categorie: 'Passation Marchés',
    statut: 'officiel',
    description: 'Dossier standard SENELEC/DPE pour lancer une procédure de passation de marché de travaux (AON, AOI, DC, Entente directe).',
    reference: 'ND SENELEC 005/2023 · CDC DPE §6',
    variables: [
      { cle: '{{PROJET_NOM}}',      libelle: 'Intitulé du projet',         exemple: 'Construction Ligne HTA 33kV Dakar-Banlieue', obligatoire: true },
      { cle: '{{CODE_PROJET}}',     libelle: 'Code unique projet',          exemple: '23DE10555035',                               obligatoire: true },
      { cle: '{{DATE_EMISSION}}',   libelle: 'Date d\'émission',            exemple: '12 juin 2026',                               obligatoire: true },
      { cle: '{{DIRECTION}}',       libelle: 'Direction porteuse',          exemple: 'DPD — Direction Principale Distribution',    obligatoire: true },
      { cle: '{{BUDGET_ESTIME}}',   libelle: 'Budget estimé (MFCFA)',       exemple: '1 250 MFCFA',                               obligatoire: true },
      { cle: '{{TYPE_MARCHE}}',     libelle: 'Type de marché',              exemple: 'Appel d\'offres national ouvert (AON)',       obligatoire: true },
      { cle: '{{CHEF_PROJET}}',     libelle: 'Chef de projet',              exemple: 'Maodo SENE',                                obligatoire: true },
      { cle: '{{BAILLEUR}}',        libelle: 'Bailleur de fonds',           exemple: 'IDA — Banque Mondiale',                     obligatoire: false },
      { cle: '{{DELAI_EXECUTION}}', libelle: 'Délai d\'exécution prévu',    exemple: '18 mois',                                   obligatoire: true },
      { cle: '{{DESCRIPTION_LOT}}', libelle: 'Description du lot / travaux', exemple: 'Fourniture et pose de câbles HTA 12/20kV', obligatoire: true },
    ],
    contenu: `# DOSSIER D'APPEL À LA PASSATION DE TRAVAUX
## Référence : {{CODE_PROJET}} | Date : {{DATE_EMISSION}}

---

### 1. IDENTIFICATION DU PROJET

| Champ | Valeur |
|---|---|
| **Intitulé** | {{PROJET_NOM}} |
| **Code projet** | {{CODE_PROJET}} |
| **Direction porteuse** | {{DIRECTION}} |
| **Chef de projet** | {{CHEF_PROJET}} |
| **Bailleur** | {{BAILLEUR}} |

---

### 2. OBJET DU MARCHÉ

**Type de procédure :** {{TYPE_MARCHE}}

**Description des travaux :**
{{DESCRIPTION_LOT}}

**Budget estimatif :** {{BUDGET_ESTIME}}

**Délai d'exécution :** {{DELAI_EXECUTION}}

---

### 3. DOCUMENTS CONSTITUTIFS DU DOSSIER

- [ ] Lettre d'invitation ou avis d'appel d'offres
- [ ] Instructions aux soumissionnaires (IS)
- [ ] Données particulières de l'appel d'offres (DPAO)
- [ ] Cahier des clauses administratives particulières (CCAP)
- [ ] Cahier des clauses techniques particulières (CCTP)
- [ ] Bordereau des quantités et des prix (BQP)
- [ ] Plans et schémas techniques
- [ ] Modèle de soumission
- [ ] Modèle de garantie de soumission
- [ ] Modèle de garantie de bonne exécution

---

### 4. CRITÈRES DE QUALIFICATION

#### 4.1 Capacité financière
- Chiffre d'affaires annuel moyen ≥ 1,5 × estimation marché
- Lignes de crédit confirmées ≥ 20% du montant marché

#### 4.2 Expérience technique
- Avoir exécuté ≥ 3 marchés similaires au cours des 5 dernières années
- Références vérifiables avec PV de réception

#### 4.3 Capacité technique
- Personnel clé : Ingénieur électricien (10 ans min.)
- Matériel : liste d'équipements minimaux conformes CCTP

---

### 5. CRITÈRES D'ÉVALUATION DES OFFRES

| Critère | Pondération |
|---|---|
| Prix (offre financière) | 70% |
| Délai d'exécution proposé | 10% |
| Qualifications du personnel | 10% |
| Plan d'exécution / méthodologie | 10% |
| **TOTAL** | **100%** |

---

### 6. CALENDRIER PRÉVISIONNEL

| Étape | Date prévisionnelle |
|---|---|
| Publication avis d'appel d'offres | |
| Date limite de dépôt des offres | |
| Ouverture des plis | |
| Évaluation technique | |
| Évaluation financière | |
| Attribution provisoire | |
| Attribution définitive | |
| Signature du contrat | |

---

### 7. CONTACTS ET DÉPÔT

**Direction Principale Équipement — SENELEC**
Avenue Lamine Guèye, BP 93, Dakar, Sénégal
Email : dpe@senelec.sn | Tél : +221 33 839 30 00

*Document émis conformément au Manuel de Procédures de Passation des Marchés SENELEC (version 2023)*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 2. Fiche Projet ─────────────────────────────────────────────────────
  {
    id: 'cv-fiche-001',
    nom: 'Fiche de Projet — Canevas standard DPE',
    categorie: 'Pilotage Projet',
    statut: 'officiel',
    description: 'Fiche d\'identification complète d\'un projet DPE (CDC §3.2). Sert de document de référence pour l\'enregistrement dans SIGEP.',
    reference: 'CDC DPE §3.2 — Référentiel projets',
    variables: [
      { cle: '{{PROJET_NOM}}',     libelle: 'Intitulé du projet',     exemple: 'Réhabilitation SS 30kV Louga', obligatoire: true },
      { cle: '{{CODE_PROJET}}',    libelle: 'Code unique',            exemple: '22DM10014027',                obligatoire: true },
      { cle: '{{DIRECTION}}',      libelle: 'Direction porteuse',     exemple: 'DPD',                         obligatoire: true },
      { cle: '{{CHEF_PROJET}}',    libelle: 'Chef de projet',         exemple: 'Ndiémé GUEYE',               obligatoire: true },
      { cle: '{{BUDGET}}',         libelle: 'Budget total (MFCFA)',   exemple: '813 MFCFA',                  obligatoire: true },
      { cle: '{{DATE_DEBUT}}',     libelle: 'Date de démarrage',      exemple: '01/03/2024',                 obligatoire: true },
      { cle: '{{DATE_FIN}}',       libelle: 'Date d\'achèvement',     exemple: '30/09/2026',                 obligatoire: true },
      { cle: '{{REGION}}',         libelle: 'Région / Zone',          exemple: 'Louga',                      obligatoire: true },
      { cle: '{{STATUT}}',         libelle: 'Statut actuel',          exemple: 'En cours — Phase travaux',   obligatoire: true },
      { cle: '{{BAILLEUR}}',       libelle: 'Bailleur / Financement', exemple: 'SENELEC — Fonds propres',   obligatoire: false },
    ],
    contenu: `# FICHE DE PROJET — {{PROJET_NOM}}
### Code : {{CODE_PROJET}} | {{DIRECTION}} | {{DATE_DEBUT}} → {{DATE_FIN}}

---

## I. IDENTIFICATION GÉNÉRALE

| Champ | Valeur |
|---|---|
| **Intitulé complet** | {{PROJET_NOM}} |
| **Code interne** | {{CODE_PROJET}} |
| **Direction porteuse** | {{DIRECTION}} |
| **Chef de projet** | {{CHEF_PROJET}} |
| **Zone / Région** | {{REGION}} |
| **Statut** | {{STATUT}} |

## II. DONNÉES FINANCIÈRES

| Indicateur | Valeur |
|---|---|
| **Budget total** | {{BUDGET}} |
| **Source de financement** | {{BAILLEUR}} |
| **Montant marchés signés** | _à compléter_ |
| **Montant décaissé** | _à compléter_ |
| **Taux décaissement** | _calculé automatiquement_ |

## III. PLANNING DIRECTEUR

| Jalon | Date prévue | Date réelle | Écart |
|---|---|---|---|
| Démarrage | {{DATE_DEBUT}} | | |
| Passation marché | | | |
| Démarrage travaux | | | |
| Achèvement 50% | | | |
| Réception provisoire | | | |
| Réception définitive | {{DATE_FIN}} | | |

## IV. INDICATEURS DE PERFORMANCE (RAG)

| Indicateur | Valeur | RAG |
|---|---|---|
| Avancement physique | % | 🟢 / 🟡 / 🔴 |
| Taux décaissement | % | 🟢 / 🟡 / 🔴 |
| CPI (coût) | | 🟢 / 🟡 / 🔴 |
| SPI (délai) | | 🟢 / 🟡 / 🔴 |

## V. RISQUES & POINTS D'ATTENTION

| # | Description | Probabilité | Impact | Mesure |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

## VI. ÉQUIPE PROJET

| Rôle | Nom | Contact |
|---|---|---|
| Chef de projet | {{CHEF_PROJET}} | |
| Contrôleur financier | | |
| Ingénieur travaux | | |
| Responsable PGES | | |

---
*Fiche générée via SIGEP-DPE · {{DATE_EMISSION}} — Confidentiel usage interne SENELEC*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 3. PV Réception provisoire ──────────────────────────────────────────
  {
    id: 'cv-pv-prov-001',
    nom: 'PV de Réception Provisoire des Travaux',
    categorie: 'Réception Travaux',
    statut: 'officiel',
    description: 'Procès-verbal officiel de réception provisoire, déclenchant la garantie de parfait achèvement (GPA). Conforme aux pratiques SENELEC.',
    reference: 'CCAP SENELEC Art. 28 · CCTG Travaux',
    variables: [
      { cle: '{{PROJET_NOM}}',    libelle: 'Intitulé du projet',  exemple: 'Ligne HTA Nord Dakar',    obligatoire: true  },
      { cle: '{{CODE_PROJET}}',   libelle: 'Code projet',         exemple: '23DE10555035',            obligatoire: true  },
      { cle: '{{NOM_ENTREPRISE}}',libelle: 'Entreprise titulaire',exemple: 'EIFFAGE Énergie Sénégal', obligatoire: true  },
      { cle: '{{CONTRAT_REF}}',   libelle: 'Référence contrat',   exemple: 'T-2024-1285',             obligatoire: true  },
      { cle: '{{DATE_PV}}',       libelle: 'Date du PV',          exemple: '15 juin 2026',            obligatoire: true  },
      { cle: '{{CHEF_PROJET}}',   libelle: 'Chef de projet',      exemple: 'Mamadou POUYE',           obligatoire: true  },
      { cle: '{{RESERVES}}',      libelle: 'Réserves (si aucune, mentionner "Aucune réserve")', exemple: 'Aucune réserve', obligatoire: true },
      { cle: '{{DELAI_LEVEE}}',   libelle: 'Délai levée de réserves', exemple: '30 jours',           obligatoire: false },
    ],
    contenu: `# PROCÈS-VERBAL DE RÉCEPTION PROVISOIRE
## Projet : {{PROJET_NOM}} — Réf. contrat : {{CONTRAT_REF}}

**Date :** {{DATE_PV}}
**Lieu :** Siège SENELEC — Direction Principale Équipement

---

### PARTIES PRÉSENTES

**MAÎTRE D'OUVRAGE — SENELEC**
- Chef de projet : {{CHEF_PROJET}}
- Représentant DPE :
- Contrôleur financier :
- Responsable HSE :

**TITULAIRE DU MARCHÉ**
- Entreprise : {{NOM_ENTREPRISE}}
- Représentant :
- Ingénieur travaux :

**MAÎTRE D'ŒUVRE (si applicable)**
- Bureau d'études :
- Représentant :

---

### OBJET ET RÉFÉRENCE

| Champ | Détail |
|---|---|
| Projet | {{PROJET_NOM}} |
| Code projet | {{CODE_PROJET}} |
| Contrat | {{CONTRAT_REF}} |
| Montant du marché | |
| Montant final (avec avenants) | |
| Délai contractuel | |
| Date réelle d'achèvement | |

---

### CONSTATS TECHNIQUES

**Travaux réalisés :**
Les travaux objet du marché {{CONTRAT_REF}} ont été inspectés ce jour {{DATE_PV}}.

**Avancement physique constaté :** ____%

**Conformité aux plans d'exécution :** ☐ Oui   ☐ Non (préciser)

**Essais et tests réalisés :** ☐ Satisfaisants   ☐ Non satisfaisants

---

### RÉSERVES

{{RESERVES}}

*(Délai de levée des réserves : {{DELAI_LEVEE}})*

---

### DÉCISION

☐ **RÉCEPTION PROVISOIRE PRONONCÉE** sans réserve — à la date du {{DATE_PV}}

☐ **RÉCEPTION PROVISOIRE PRONONCÉE AVEC RÉSERVES** — voir liste ci-dessus

☐ **AJOURNEMENT** — motif :

---

### DISPOSITIONS FINANCIÈRES CONSÉCUTIVES

- Libération de 50% de la retenue de garantie
- Démarrage de la période de garantie de parfait achèvement (GPA) : 12 mois
- Démarrage de la garantie de bon fonctionnement (GBF) pour les équipements

---

### SIGNATURES

| Rôle | Nom | Signature | Date |
|---|---|---|---|
| Chef de projet SENELEC | {{CHEF_PROJET}} | | {{DATE_PV}} |
| Directeur DPE | | | |
| Représentant titulaire | | | |
| Représentant MOE | | | |

---
*Document officiel SENELEC · Confidentiel*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 4. Rapport mensuel d'avancement ────────────────────────────────────
  {
    id: 'cv-rapport-mensuel-001',
    nom: 'Rapport d\'Avancement Mensuel (RAM)',
    categorie: 'Suivi-Évaluation',
    statut: 'officiel',
    description: 'Rapport mensuel standard CDC §8 pour le suivi-évaluation du portefeuille DPE. Inclut indicateurs physiques, financiers, risques et actions.',
    reference: 'CDC DPE §8 · Circulaire DG SENELEC 003/2024',
    variables: [
      { cle: '{{MOIS_ANNEE}}',   libelle: 'Période (Mois Année)',  exemple: 'Juin 2026',   obligatoire: true },
      { cle: '{{DIRECTION}}',    libelle: 'Direction',             exemple: 'DPD',         obligatoire: true },
      { cle: '{{AUTEUR}}',       libelle: 'Rédacteur',             exemple: 'Maodo SENE',  obligatoire: true },
      { cle: '{{NB_PROJETS}}',   libelle: 'Nb projets actifs',     exemple: '53',          obligatoire: true },
      { cle: '{{AVANCEMENT_MOY}}',libelle: 'Avancement moyen (%)', exemple: '67%',         obligatoire: true },
      { cle: '{{TAUX_DEC}}',     libelle: 'Taux décaissement (%)', exemple: '58%',         obligatoire: true },
    ],
    contenu: `# RAPPORT D'AVANCEMENT MENSUEL — {{MOIS_ANNEE}}
### {{DIRECTION}} | Rédacteur : {{AUTEUR}}

---

## 1. TABLEAU DE BORD EXÉCUTIF

| Indicateur | Valeur | Variation M-1 | RAG |
|---|---|---|---|
| Projets actifs | {{NB_PROJETS}} | | 🟢 |
| Avancement physique moyen | {{AVANCEMENT_MOY}} | | 🟡 |
| Taux de décaissement | {{TAUX_DEC}} | | 🟡 |
| Projets en retard (SPI < 0,85) | | | 🔴 |
| Projets critiques (CPI < 0,9) | | | 🔴 |
| KPI validés / total | | | |

---

## 2. AVANCEMENT PAR PROJET PRIORITAIRE

| Code | Intitulé | Avanc. % | Décaissé (M) | Statut | RAG |
|---|---|---|---|---|---|
| | | | | | |
| | | | | | |
| | | | | | |

---

## 3. SITUATION FINANCIÈRE

### 3.1 Budget portefeuille
| Indicateur | Montant (MFCFA) |
|---|---|
| Budget total autorisé | |
| Engagements cumulés | |
| Décaissements cumulés | |
| Solde disponible | |
| Prévisions décaissement M+1 | |

### 3.2 Décomptes certifiés ce mois
| Projet | Décompte N° | Montant HT (FCFA) | Statut |
|---|---|---|---|
| | | | |

---

## 4. POINTS SAILLANTS — RÉALISATIONS DU MOIS

-
-
-

## 5. DIFFICULTÉS ET BLOCAGES

| # | Description | Cause | Impact | Mesure corrective | Responsable |
|---|---|---|---|---|---|
| 1 | | | | | |
| 2 | | | | | |

---

## 6. ACTIVITÉS PLANIFIÉES M+1

-
-
-

## 7. DÉCISIONS REQUISES DE LA HIÉRARCHIE

| # | Décision requise | Échéance | Demandeur |
|---|---|---|---|
| 1 | | | |

---
*Rapport confidentiel — Usage interne SENELEC DPE — {{MOIS_ANNEE}}*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 5. Note de Consultation ─────────────────────────────────────────────
  {
    id: 'cv-nc-001',
    nom: 'Note de Consultation (NC) — Procédure simplifiée',
    categorie: 'Passation Marchés',
    statut: 'officiel',
    description: 'Note de consultation pour les marchés de faible montant par mise en concurrence simplifiée (≤ 50M FCFA).',
    reference: 'Manuel Passation Marchés SENELEC §4.3',
    variables: [
      { cle: '{{OBJET}}',       libelle: 'Objet de la consultation', exemple: 'Fourniture câbles BT 35mm²', obligatoire: true },
      { cle: '{{BUDGET_MAX}}',  libelle: 'Budget maximum (FCFA)',    exemple: '25 000 000 FCFA',            obligatoire: true },
      { cle: '{{DATE_LIMITE}}', libelle: 'Date limite de remise',    exemple: '25 juin 2026 à 12h00',       obligatoire: true },
      { cle: '{{CONTACT}}',     libelle: 'Responsable achat',        exemple: 'Service UAGL — DPE',         obligatoire: true },
    ],
    contenu: `# NOTE DE CONSULTATION

**Objet :** {{OBJET}}
**Budget maximum :** {{BUDGET_MAX}}
**Date limite de remise :** {{DATE_LIMITE}}
**Contact :** {{CONTACT}}

---

## 1. CONTEXTE ET JUSTIFICATION

_Décrire brièvement le besoin et le cadre du projet._

## 2. PRESTATIONS DEMANDÉES

_Détailler les fournitures / services / travaux attendus, avec spécifications techniques minimales._

## 3. DOCUMENTS À FOURNIR

- [ ] Devis détaillé signé et cacheté
- [ ] Registre de commerce (NINEA)
- [ ] Attestation fiscale en cours de validité
- [ ] Références similaires (≥ 2)
- [ ] Délai de livraison proposé

## 4. CRITÈRES DE SÉLECTION

| Critère | Pondération |
|---|---|
| Prix | 60% |
| Délai | 20% |
| Qualité technique | 20% |

## 5. MODALITÉS DE REMISE DES OFFRES

Les offres doivent être déposées sous pli fermé à l'adresse :
{{CONTACT}} — SENELEC, Avenue Lamine Guèye, Dakar

*avant le {{DATE_LIMITE}}*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 6. Termes de Référence ──────────────────────────────────────────────
  {
    id: 'cv-tdr-001',
    nom: 'Termes de Référence (TdR) — Mission d\'assistance technique',
    categorie: 'Passation Marchés',
    statut: 'officiel',
    description: 'Termes de référence pour le recrutement d\'un consultant/bureau d\'études en assistance technique.',
    reference: 'Directives Banque Mondiale SPN · CDC DPE §5',
    variables: [
      { cle: '{{MISSION}}',     libelle: 'Titre de la mission',      exemple: 'Bureau de contrôle travaux HTA', obligatoire: true },
      { cle: '{{DUREE}}',       libelle: 'Durée de la mission',      exemple: '18 mois',                        obligatoire: true },
      { cle: '{{EXPERTISE}}',   libelle: 'Expertise requise',        exemple: 'Ingénieur Électrotechnicien Bac+5, 10 ans min.', obligatoire: true },
      { cle: '{{CHEF_PROJET}}', libelle: 'Chef de projet responsable', exemple: 'Maodo SENE',                 obligatoire: true },
    ],
    contenu: `# TERMES DE RÉFÉRENCE — {{MISSION}}

**Durée :** {{DUREE}} | **Responsable SENELEC :** {{CHEF_PROJET}}

---

## 1. CONTEXTE
_Présenter le projet et la nécessité de l'assistance technique._

## 2. OBJECTIFS DE LA MISSION
- Objectif général :
- Objectifs spécifiques :

## 3. TÂCHES ET LIVRABLES

| # | Tâche | Livrable | Délai |
|---|---|---|---|
| 1 | | | |
| 2 | | | |

## 4. PROFIL DU CONSULTANT / ÉQUIPE

**Expertise requise :** {{EXPERTISE}}

**Personnel clé minimum :**
- Chef de mission : ...
- Ingénieur(s) spécialiste(s) : ...

## 5. RAPPORTS ET COMMUNICATION

- Rapport de démarrage : J+15
- Rapports mensuels
- Rapport final

## 6. DONNÉES DISPONIBLES

_SENELEC mettra à disposition : plans, données techniques, accès aux sites._

## 7. MODALITÉS D'ÉVALUATION

Sélection sur la base de la Qualité et du Coût (SBQC)
Pondération : Qualité 80% / Prix 20%`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },

  // ─── 7. Compte Rendu de Réunion ──────────────────────────────────────────
  {
    id: 'cv-cr-001',
    nom: 'Compte Rendu de Réunion de Chantier',
    categorie: 'Pilotage Projet',
    statut: 'officiel',
    description: 'CR de réunion de chantier hebdomadaire / mensuelle entre SENELEC, entreprise et maître d\'œuvre.',
    reference: 'Pratique standard DPE',
    variables: [
      { cle: '{{DATE_REUNION}}', libelle: 'Date de réunion',     exemple: '12 juin 2026',    obligatoire: true },
      { cle: '{{PROJET_NOM}}',   libelle: 'Projet concerné',     exemple: 'Ligne HTA Dakar', obligatoire: true },
      { cle: '{{LIEU}}',         libelle: 'Lieu de réunion',     exemple: 'Chantier — Rufisque', obligatoire: true },
      { cle: '{{NUMERO_CR}}',    libelle: 'Numéro CR',           exemple: 'CR-2026-047',     obligatoire: true },
      { cle: '{{ANIMATEUR}}',    libelle: 'Animateur / Président', exemple: 'Maodo SENE',   obligatoire: true },
    ],
    contenu: `# COMPTE RENDU DE RÉUNION N° {{NUMERO_CR}}
## Projet : {{PROJET_NOM}} — {{DATE_REUNION}}
**Lieu :** {{LIEU}} | **Animateur :** {{ANIMATEUR}}

---

### PARTICIPANTS

| Nom | Organisme | Rôle |
|---|---|---|
| | | |

### POINTS ABORDÉS

**1. Avancement des travaux**
- Avancement physique cumulé : _____%
- Travaux réalisés depuis dernier CR :
- Difficultés rencontrées :

**2. Situation des approvisionnements**
- Matériaux disponibles sur site :
- Commandes en attente :

**3. Sécurité et HSE**
- Incidents signalés :
- Observations :

**4. Qualité**
- Points de contrôle effectués :
- Non-conformités :

**5. Points financiers**
- Décompte en cours :
- Factures en attente :

---

### DÉCISIONS ET ACTIONS

| # | Action | Responsable | Échéance | Statut |
|---|---|---|---|---|
| 1 | | | | |
| 2 | | | | |

### PROCHAINE RÉUNION

Date : _____________ | Lieu : _____________

---
*CR diffusé à tous les participants — Retour sous 48h pour corrections*`,
    dateCreation: today, dateMAJ: today, auteur: 'DPE — SIGEP', usageCount: 0,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Store Zustand
// ─────────────────────────────────────────────────────────────────────────────

interface CanevasStore {
  canevas:    Canevas[];
  addCanevas: (c: Omit<Canevas, 'id' | 'dateCreation' | 'dateMAJ' | 'usageCount'>) => string;
  updateCanevas: (id: string, patch: Partial<Canevas>) => void;
  deleteCanevas: (id: string) => void;
  incrementUsage: (id: string) => void;
}

export const useCanevasStore = create<CanevasStore>()(
  persist(
    (set) => ({
      canevas: CANEVAS_OFFICIELS,

      addCanevas: (c) => {
        const id = nanoid();
        const now = new Date().toISOString().split('T')[0];
        set(s => ({
          canevas: [...s.canevas, { ...c, id, dateCreation: now, dateMAJ: now, usageCount: 0 }],
        }));
        return id;
      },

      updateCanevas: (id, patch) =>
        set(s => ({
          canevas: s.canevas.map(c =>
            c.id === id ? { ...c, ...patch, dateMAJ: new Date().toISOString().split('T')[0] } : c
          ),
        })),

      deleteCanevas: (id) =>
        set(s => ({ canevas: s.canevas.filter(c => c.id !== id) })),

      incrementUsage: (id) =>
        set(s => ({
          canevas: s.canevas.map(c => c.id === id ? { ...c, usageCount: c.usageCount + 1 } : c),
        })),
    }),
    { name: 'sigep-canevas' }
  )
);
