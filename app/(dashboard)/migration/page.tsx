/**
 * migration/page.tsx — Wizard de migration intelligente de projets
 * 5 étapes : Upload → Analyse IA → Construction → Validation → Finalisation
 */

'use client';

import { useState, useCallback, useRef, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Upload, FileText, Brain, CheckCircle, Rocket,
  ChevronRight, ChevronLeft, X, FilePlus, Loader2,
  AlertTriangle, FolderOpen, RefreshCw,
} from 'lucide-react';
import { analyzeDocuments, generateProjectStructure, computeConfidence } from '@/lib/migration/engine';
import type { MigrationDocument, MigrationProject, MigrationStep, ExtractedData } from '@/lib/migration/types';
import { listZipEntries, isArchive, isZip } from '@/lib/migration/zip';
import { swarmAnalyze, swarmFinalize, swarmProjectToExtracted, type SwarmImmobilisation } from '@/lib/migration/backend';
import { useProjectStore, type Domaine, type Projet } from '@/lib/projectStore';
import { useAuth } from '@/lib/authStore';
import { extractFileText } from '@/lib/docText';
import { useStructurationStore } from '@/lib/structuration/store';
import { structurerDepuisBOQ, type BOQInputRow } from '@/lib/structuration/builder';
import toast from 'react-hot-toast';

/** Convertit une date dd/mm/yyyy ou dd-mm-yyyy en ISO YYYY-MM-DD (sinon repli). */
function toISODate(d?: string, fallback?: string): string {
  if (d) {
    const m = d.match(/(\d{2})[\/\-](\d{2})[\/\-](\d{4})/);
    if (m) return `${m[3]}-${m[2]}-${m[1]}`;
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) return d.trim();
  }
  return fallback ?? new Date().toISOString().slice(0, 10);
}

/** Déduit le domaine DPE à partir du texte (nom/type de projet). */
function inferDomaine(...hints: (string | undefined)[]): Domaine {
  const t = hints.filter(Boolean).join(' ').toLowerCase();
  if (/transport|ligne\s*ht|225|90\s*kv|poste\s*(ht|source)/.test(t)) return 'transport';
  if (/production|centrale|solaire|photovolta|éolien|eolien|turbine|groupe/.test(t)) return 'production';
  if (/génie civil|genie civil|batiment|bâtiment|ouvrage/.test(t)) return 'genie_civil';
  if (/commercial|compteur|clientèle|clientele|smart\s*grid|comptage/.test(t)) return 'commercial';
  return 'distribution';
}

/**
 * Branchement Migration → Structuration : l'IA a extrait le bordereau (wbsItems) +
 * les lots ; on construit DIRECTEMENT l'arbre Composant → Sous-composant → Article
 * pour ce projet, prêt à valider puis immobiliser. Plus de structuration manuelle.
 * Retourne le nombre de composants générés (0 si rien d'exploitable).
 */
function genererStructurationDepuisMigration(
  ex: ExtractedData,
  projetCode: string,
  projetNom: string,
  saver: (s: ReturnType<typeof structurerDepuisBOQ>) => void,
): number {
  if (!projetCode) return 0;
  const rows: BOQInputRow[] = [];
  // 1) Lignes de bordereau (BOQ / WBS chiffré) détectées par l'IA.
  (ex.wbsItems ?? []).forEach(w => {
    if (!w || (!w.label && !w.code)) return;
    rows.push({
      code: w.code || undefined,
      designation: w.label || w.code || 'Poste',
      unite: 'U',
      quantite: 1,
      prixUnitaire: typeof w.budget === 'number' ? w.budget : 0,
      devise: (ex.currency as BOQInputRow['devise']) || 'CFA',
    });
  });
  // 2) Repli : à défaut de bordereau, chaque LOT devient un sous-composant chiffré.
  if (rows.length === 0) {
    (ex.lots ?? []).forEach(l => rows.push({
      code: `LOT.${l.numero}`,
      designation: l.label || `Lot ${l.numero}`,
      unite: 'lot', quantite: 1,
      prixUnitaire: typeof l.budget === 'number' ? l.budget : 0,
      devise: (ex.currency as BOQInputRow['devise']) || 'CFA',
    }));
  }
  if (rows.length === 0) return 0;
  const s = structurerDepuisBOQ(rows, {
    projetCode, projetNom,
    deviseRef: (ex.currency as BOQInputRow['devise']) || 'CFA',
    source: 'IA · Migration (bordereau extrait)',
  });
  saver(s);
  return s.composants.length;
}

const STEPS: { id: MigrationStep; label: string; icon: React.ElementType }[] = [
  { id: 'upload', label: 'Charger les documents', icon: Upload },
  { id: 'analyze', label: 'Analyse IA', icon: Brain },
  { id: 'build', label: 'Construction projet', icon: FilePlus },
  { id: 'validate', label: 'Validation humaine', icon: CheckCircle },
  { id: 'finalize', label: 'Finalisation SIGEPP', icon: Rocket },
];

export default function MigrationPage() {
  const router = useRouter();
  const store = useProjectStore();
  const struct = useStructurationStore();
  const { user } = useAuth();
  const [step, setStep] = useState<number>(0);
  const [docs, setDocs] = useState<MigrationDocument[]>([]);
  const [project, setProject] = useState<Partial<MigrationProject>>({});
  const [extracted, setExtracted] = useState<ExtractedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fichiers réels (envoyés au swarm backend) + sorties du swarm
  const [rawFiles, setRawFiles] = useState<File[]>([]);
  const [swarmState, setSwarmState] = useState<Record<string, any> | null>(null);
  const [immos, setImmos] = useState<SwarmImmobilisation[]>([]);
  const [engineLabel, setEngineLabel] = useState<string>('');
  const [createdId, setCreatedId] = useState<string>('');
  // Champs acceptés par l'humain lors d'une MISE À JOUR d'un projet existant.
  const [acceptedFields, setAcceptedFields] = useState<Record<string, boolean>>({});

  const currentStep = STEPS[step];

  /** Normalise un code projet (BIT) pour comparaison : MAJ, sans séparateur. */
  const normCode = (c?: string) => (c || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // ── Rapprochement avec un projet DÉJÀ présent dans la plateforme (par code BIT).
  //    Si le document migré porte un code projet qui existe déjà, on propose une
  //    MISE À JOUR (human-in-the-loop) plutôt qu'une création en double.
  const existingMatch = useMemo<Projet | null>(() => {
    const code = normCode(extracted?.projectCode);
    if (!code || code.length < 4) return null;
    return store.projets.find(p => normCode(p.code) === code) || null;
  }, [extracted, store.projets]);

  // ── Diff champ par champ : valeur actuelle (plateforme) → valeur proposée (document).
  const proposedDiff = useMemo(() => {
    if (!existingMatch || !extracted) return [] as { key: string; label: string; current: any; next: any; patch: Partial<Projet> }[];
    const ex = extracted;
    const rawBudget = ex.budget ?? 0;
    const budgetM = rawBudget >= 1_000_000 ? Math.round(rawBudget / 1_000_000) : Math.round(rawBudget);
    const rows: { key: string; label: string; current: any; next: any; patch: Partial<Projet> }[] = [];
    const push = (key: string, label: string, current: any, next: any, patch: Partial<Projet>) => {
      if (next === undefined || next === null || next === '' ) return;
      if (String(current ?? '') === String(next)) return; // pas de changement
      rows.push({ key, label, current, next, patch });
    };
    push('nom', 'Nom du projet', existingMatch.nom, ex.projectName, { nom: ex.projectName });
    if (budgetM > 0) push('budget', 'Budget (M FCFA)', existingMatch.budget, budgetM, { budget: budgetM });
    push('chefProjet', 'Chef de projet', existingMatch.chefProjet, ex.contractor && /chef|resp/i.test(ex.contractor) ? ex.contractor : undefined, { chefProjet: ex.contractor });
    push('localisation', 'Localisation', existingMatch.localisation, ex.location, { localisation: ex.location, region: ex.location });
    if (ex.startDate) push('dateDebut', 'Date de début', existingMatch.dateDebut, toISODate(ex.startDate, existingMatch.dateDebut), { dateDebut: toISODate(ex.startDate, existingMatch.dateDebut) });
    if (ex.endDate) push('dateFinPrevue', 'Date de fin prévue', existingMatch.dateFinPrevue, toISODate(ex.endDate, existingMatch.dateFinPrevue), { dateFinPrevue: toISODate(ex.endDate, existingMatch.dateFinPrevue) });
    if (ex.contractor) push('contractant', 'Contractant (bailleur)', existingMatch.bailleurs?.[0]?.nom ?? '—', ex.contractor, { bailleurs: [{ nom: ex.contractor, montant: existingMatch.budget, devise: 'FCFA', pourcentage: 100 }] });
    return rows;
  }, [existingMatch, extracted]);

  // Par défaut, toutes les modifications proposées sont cochées (acceptées).
  useEffect(() => {
    if (proposedDiff.length) {
      setAcceptedFields(prev => {
        const next = { ...prev };
        proposedDiff.forEach(r => { if (next[r.key] === undefined) next[r.key] = true; });
        return next;
      });
    }
  }, [proposedDiff]);

  /** Applique au projet existant uniquement les champs acceptés par l'humain. */
  const updateExisting = useCallback((): string => {
    if (!existingMatch) return '';
    const patch: Partial<Projet> = {};
    proposedDiff.forEach(r => { if (acceptedFields[r.key]) Object.assign(patch, r.patch); });
    const n = Object.keys(patch).length;
    if (n === 0) {
      toast('Aucune modification sélectionnée — projet inchangé.', { icon: 'ℹ️' });
      return existingMatch.id;
    }
    store.updateProjet(existingMatch.id, patch);
    toast.success(`Projet « ${existingMatch.nom} » mis à jour (${n} champ(s)) à partir des documents.`, { duration: 3500 });
    return existingMatch.id;
  }, [existingMatch, proposedDiff, acceptedFields, store]);

  const handleFiles = useCallback(async (files: FileList | null) => {
    if (!files) return;
    setError('');
    const newDocs: MigrationDocument[] = [];
    const mkId = () => `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    // On conserve les fichiers RÉELS pour les envoyer au swarm backend (OCR/extraction).
    setRawFiles(prev => [...prev, ...Array.from(files)]);

    for (const file of Array.from(files)) {
      // 1) Archive ZIP : on déplie le dossier projet → 1 document par fichier contenu
      if (isZip(file.name)) {
        try {
          const entries = await listZipEntries(file);
          if (entries.length === 0) throw new Error('archive vide');
          for (const e of entries) {
            const base = e.name.split('/').pop() || e.name;
            newDocs.push({
              id: mkId(), name: base, type: inferDocType(base, ''),
              size: e.uncompressedSize, url: '',
              uploadedAt: new Date().toISOString(), status: 'uploaded',
            });
          }
          continue;
        } catch {
          setError(`Impossible de lire l'archive ${file.name} (ZIP64 non géré). Elle sera traitée comme un lot à extraire côté serveur.`);
          // repli → traitée comme bundle ci-dessous
        }
      }

      // 2) RAR / 7z (ou ZIP illisible) : lot transmis pour extraction back-end
      if (isArchive(file.name)) {
        newDocs.push({
          id: mkId(), name: file.name, type: 'other',
          size: file.size, url: URL.createObjectURL(file),
          uploadedAt: new Date().toISOString(), status: 'uploaded',
        });
        continue;
      }

      // 3) Document simple
      newDocs.push({
        id: mkId(), name: file.name, type: inferDocType(file.name, file.type),
        size: file.size, url: URL.createObjectURL(file),
        uploadedAt: new Date().toISOString(), status: 'uploaded',
      });
    }
    setDocs(prev => [...prev, ...newDocs]);
  }, []);

  const removeDoc = useCallback((id: string) => {
    setDocs(prev => prev.filter(d => d.id !== id));
  }, []);

  const runAnalysis = useCallback(async () => {
    if (docs.length === 0) { setError('Veuillez charger au moins un document.'); return; }
    setLoading(true);
    setError('');
    try {
      // 1) PRIORITÉ : Swarm multi-agents backend (LangGraph + OCR open source).
      //    Plusieurs agents (document intelligence, planificateur, QA, comptable
      //    immobilisations DAIC…) exploitent les fichiers réels.
      try {
        const res = await swarmAnalyze(rawFiles);
        const data = swarmProjectToExtracted(res);
        setExtracted(data);
        setProject(generateProjectStructure(data));
        setSwarmState(res.state);
        setImmos(res.immobilisations || []);
        const eng = res.engine || {};
        setEngineLabel(
          `Swarm ${eng.langgraph ? 'LangGraph' : 'séquentiel'} · LLM: ${eng.llm_backend || 'n/a'} · ` +
          `${(res.qa?.confidence ?? 0)}% confiance · ${(res.immobilisations || []).length} immobilisation(s) DAIC`
        );
        setStep(2);
        return;
      } catch {
        // 2) REPLI : moteur heuristique local (backend indisponible).
        setEngineLabel('Mode local (backend swarm indisponible) — extraction heuristique');
      }
      // Extraction RÉELLE du texte des fichiers chargés (PDF, Word, Excel, texte)
      // côté navigateur, pour que le moteur heuristique exploite le contenu réel.
      const fileTexts = await Promise.all(
        rawFiles.map(async f => {
          const txt = await extractFileText(f).catch(() => undefined);
          return { name: f.name, text: txt };
        })
      );
      const textByName = new Map(fileTexts.map(ft => [ft.name, ft.text]));
      const docsWithText = docs.map(d => ({
        ...d,
        extractedText: textByName.get(d.name)
          || `Projet : ${d.name.replace(/\.[^.]+$/, '')}`,
      }));
      const data = await analyzeDocuments(docsWithText);
      if (fileTexts.some(ft => ft.text && ft.text.length > 40)) {
        setEngineLabel('Mode local — extraction client (PDF/Word/Excel) du contenu réel des documents');
      }
      setExtracted(data);
      setProject(generateProjectStructure(data));
      setSwarmState(null);
      setImmos([]);
      setStep(2);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de l\'analyse');
    } finally {
      setLoading(false);
    }
  }, [docs, rawFiles]);

  // ── Création RÉELLE du projet dans SIGEPP à partir des données extraites ──
  const createInStore = useCallback((): string => {
    try {
      const ex = extracted ?? {};
      const today = new Date().toISOString().slice(0, 10);
      // Budget : le store raisonne en MFCFA. On convertit les montants bruts FCFA.
      const rawBudget = ex.budget ?? 0;
      const budgetM = rawBudget >= 1_000_000 ? Math.round(rawBudget / 1_000_000) : Math.round(rawBudget);
      const debut = toISODate(ex.startDate, today);
      const fin = toISODate(ex.endDate, `${new Date().getFullYear() + 2}-12-31`);
      const domaine = inferDomaine(ex.projectType, ex.projectName, ex.location);
      const code = (ex.projectCode && ex.projectCode.trim())
        || `PRJ-MIG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const nouveau: Omit<Projet, 'id' | 'dateCreation' | 'dateModification' | 'taches'> = {
        domaine,
        nom: ex.projectName || project.name || 'Projet migré',
        code,
        description: `Projet créé par migration intelligente à partir de ${docs.length} document(s).`
          + (ex.contractor ? ` Contractant : ${ex.contractor}.` : '')
          + (ex.deliverables?.length ? ` Livrables : ${ex.deliverables.slice(0, 5).join(', ')}.` : ''),
        chefProjet: user ? `${user.prenom} ${user.nom}` : 'À désigner',
        localisation: ex.location || 'Sénégal',
        region: ex.location || 'Dakar',
        avancement: 0,
        avancementPlanifie: 0,
        budget: budgetM,
        budgetEngage: 0,
        budgetDecaisse: 0,
        dateDebut: debut,
        dateFinPrevue: fin,
        dateFinEstimee: fin,
        statut: 'en_cours',
        priorite: 'Moyenne',
        cpi: 1,
        spi: 1,
        bailleurs: [],
        equipe: [],
        jalons: (ex.milestones ?? []).filter(m => m.name).slice(0, 12).map(m => ({
          label: m.name, date: toISODate(m.date, fin), atteint: false,
        })),
        departement: user?.departement,
        unite: user?.cellule,
        metadata: {
          migration: true,
          confiance: extracted ? computeConfidence(extracted) : 0,
          documentsSources: docs.map(d => d.name),
          immobilisations: immos.length,
        },
      };
      const created = store.createProjet(nouveau);
      toast.success(`Projet « ${created.nom} » créé dans SIGEPP à partir des documents.`, { duration: 3500 });
      // ── Branchement automatique vers la STRUCTURATION des actifs ──
      const nbComp = genererStructurationDepuisMigration(ex, created.code, created.nom, struct.save);
      if (nbComp > 0) toast.success(`Structuration générée : ${nbComp} composant(s) — à valider puis immobiliser.`, { duration: 4500, icon: '🧱' });
      return created.id;
    } catch {
      toast.error('Le projet a été préparé mais n\'a pas pu être enregistré automatiquement.');
      return '';
    }
  }, [extracted, project, docs, immos, user, store, struct]);

  // ── Création MULTI-LOTS : chaque lot devient un sous-projet séparé, rattaché à
  //    un même « projet parent » (code) pour permettre la consolidation ultérieure.
  const createLotsInStore = useCallback((): string => {
    const ex = extracted ?? {};
    const lots = ex.lots ?? [];
    if (lots.length < 2) return createInStore();
    const today = new Date().toISOString().slice(0, 10);
    const debut = toISODate(ex.startDate, today);
    const fin = toISODate(ex.endDate, `${new Date().getFullYear() + 2}-12-31`);
    const domaine = inferDomaine(ex.projectType, ex.projectName, ex.location);
    const baseNom = ex.projectName || project.name || 'Projet migré';
    const baseCode = (ex.projectCode && ex.projectCode.trim()) || `PRJ-MIG-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
    const rawTotal = ex.budget ?? 0;
    const totalM = rawTotal >= 1_000_000 ? Math.round(rawTotal / 1_000_000) : Math.round(rawTotal);
    let firstId = '';
    let firstCode = '';
    lots.forEach((lot, i) => {
      const lotBudgetRaw = lot.budget ?? 0;
      const lotBudgetM = lotBudgetRaw > 0
        ? (lotBudgetRaw >= 1_000_000 ? Math.round(lotBudgetRaw / 1_000_000) : Math.round(lotBudgetRaw))
        : (totalM > 0 ? Math.round(totalM / lots.length) : 0);
      const created = store.createProjet({
        domaine,
        nom: `${baseNom} — Lot ${lot.numero}${lot.label ? ` : ${lot.label.slice(0, 50)}` : ''}`,
        code: `${baseCode}-L${lot.numero}`,
        description: `Lot ${lot.numero} du marché « ${baseNom} » (migration multi-lots).${lot.label ? ` Objet : ${lot.label}.` : ''}`,
        objectif: lot.label || baseNom,
        chefProjet: user ? `${user.prenom} ${user.nom}` : 'À désigner',
        localisation: lot.localisation || ex.location || 'Sénégal',
        region: lot.localisation || ex.location || 'Dakar',
        avancement: 0, avancementPlanifie: 0,
        budget: lotBudgetM, budgetEngage: 0, budgetDecaisse: 0,
        dateDebut: debut, dateFinPrevue: fin, dateFinEstimee: fin,
        statut: 'en_cours', priorite: 'Moyenne', cpi: 1, spi: 1,
        bailleurs: [], equipe: [], jalons: [],
        departement: user?.departement, unite: user?.cellule,
        metadata: {
          migration: true, lotParent: baseCode, lotNumero: lot.numero,
          consolidable: true, documentsSources: docs.map(d => d.name),
        },
      });
      if (i === 0) { firstId = created.id; firstCode = created.code; }
    });
    toast.success(`${lots.length} lots créés comme sous-projets (parent ${baseCode}) — consolidables.`, { duration: 4000 });
    // Structuration des actifs sur le projet pilote (à partir du bordereau / des lots).
    const nbComp = genererStructurationDepuisMigration(ex, firstCode || baseCode, baseNom, struct.save);
    if (nbComp > 0) toast.success(`Structuration générée : ${nbComp} composant(s) — à valider puis immobiliser.`, { duration: 4500, icon: '🧱' });
    return firstId;
  }, [extracted, project, docs, user, store, struct, createInStore]);

  // Mode de création choisi par l'humain quand des lots sont détectés.
  const [creerParLot, setCreerParLot] = useState(true);

  const multiLots = (extracted?.lots?.length ?? 0) > 1;

  const validateProject = useCallback((approved: boolean) => {
    if (approved) {
      // Priorité : MAJ d'un projet existant (code BIT) → sinon, si plusieurs lots
      // détectés et création par lot retenue → un sous-projet par lot → sinon création simple.
      const id = existingMatch
        ? updateExisting()
        : (multiLots && creerParLot ? createLotsInStore() : createInStore());
      setCreatedId(id);
      setProject(prev => ({ ...prev, status: 'validated' as const, updatedAt: new Date().toISOString() }));
      setStep(4); // Finalisation
    } else {
      setStep(1); // Retour analyse
    }
  }, [createInStore, createLotsInStore, existingMatch, updateExisting, multiLots, creerParLot]);

  const finalizeProject = useCallback(async () => {
    // Si le swarm backend a produit un état, on applique la validation humaine
    // (assembleur) côté backend ; sinon on finalise localement.
    try {
      if (swarmState) {
        await swarmFinalize(swarmState, { status: 'validated' });
      }
    } catch { /* tolérant : on poursuit la finalisation locale */ }
    setProject(prev => ({ ...prev, status: 'generated' as const, updatedAt: new Date().toISOString() }));
    setTimeout(() => router.push(createdId ? `/cockpit-projet?projet=${encodeURIComponent(createdId)}` : '/projets'), 1200);
  }, [router, swarmState, createdId]);

  return (
    <div className="page-content" style={{ maxWidth: 1000, margin: '0 auto' }}>
      {/* Header wizard */}
      <div className="page-header">
        <div>
          <div className="page-title">Migration intelligente de projet</div>
          <div className="page-subtitle">Chargez vos documents, l'IA prépare tout, vous validez.</div>
        </div>
      </div>

      {/* Steps indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
              opacity: i <= step ? 1 : 0.4,
            }}>
              <div style={{
                width: 36, height: 36, borderRadius: '50%',
                background: i <= step ? 'var(--primary)' : 'var(--gray-200)',
                color: i <= step ? '#fff' : 'var(--text-muted)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 14, fontWeight: 700,
              }}>
                {i < step ? <CheckCircle size={16} /> : <s.icon size={16} />}
              </div>
              <span style={{ fontSize: 9, fontWeight: 600, textAlign: 'center', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{
                flex: 1, height: 2,
                background: i < step ? 'var(--primary)' : 'var(--gray-200)',
                margin: '0 8px', marginBottom: 18,
              }} />
            )}
          </div>
        ))}
      </div>

      {error && (
        <div className="banner banner-error" style={{ marginBottom: 16 }}>
          <AlertTriangle size={16} /> {error}
        </div>
      )}

      {/* ── STEP 1 : UPLOAD ── */}
      {step === 0 && (
        <div className="card">
          <div className="card-body">
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
              style={{
                border: '2px dashed var(--border-md)',
                borderRadius: 12,
                padding: 40,
                textAlign: 'center',
                cursor: 'pointer',
                background: 'var(--gray-50)',
                transition: 'border-color 0.2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border-md)')}
            >
              <Upload size={40} style={{ color: 'var(--primary)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                Déposez une archive ZIP/RAR du dossier projet, ou des documents, ou cliquez pour parcourir
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Archive ZIP/RAR de tout le dossier · ou PDF, Word, Excel, Images (contrats, DAO, bordereaux, rapports, PV, plans…).
                L'IA déplie l'archive, extrait les données puis vous validez (human-in-the-loop).
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".zip,.rar,.7z,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.dwg,.jpg,.jpeg,.png,.tiff"
                style={{ display: 'none' }}
                onChange={e => handleFiles(e.target.files)}
              />
            </div>

            {docs.length > 0 && (
              <div style={{ marginTop: 20 }}>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>{docs.length} document{docs.length > 1 ? 's' : ''} chargé(s)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {docs.map(d => (
                    <div key={d.id} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 10px', background: 'var(--bg-card)', borderRadius: 8,
                      border: '1px solid var(--border)',
                    }}>
                      <FileText size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                      <span style={{ fontSize: 12, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{(d.size / 1024).toFixed(0)} ko</span>
                      <button onClick={() => removeDoc(d.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button className="btn btn-primary" onClick={() => setStep(1)} disabled={docs.length === 0}>
              Continuer <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 2 : ANALYZE ── */}
      {step === 1 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            {loading ? (
              <>
                <Loader2 size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
                <div style={{ fontSize: 16, fontWeight: 700 }}>L'IA analyse vos documents…</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
                  Extraction OCR • Classification • Détection des clauses • Génération WBS
                </div>
              </>
            ) : (
              <>
                <Brain size={48} style={{ color: 'var(--primary)', margin: '0 auto 16px' }} />
                <div style={{ fontSize: 16, fontWeight: 700 }}>Prêt pour l'analyse IA</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 20 }}>
                  {docs.length} document(s) seront analysés pour extraire automatiquement la structure du projet.
                </div>
                <button className="btn btn-primary" onClick={runAnalysis}>
                  <Brain size={14} /> Lancer l'analyse IA
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── STEP 3 : BUILD ── */}
      {step === 2 && extracted && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><FilePlus size={14} /> Projet généré par l'IA</span>
            <span className={`badge ${computeConfidence(extracted) > 70 ? 'badge-success' : computeConfidence(extracted) > 40 ? 'badge-warning' : 'badge-danger'}`}>
              Confiance : {computeConfidence(extracted)}%
            </span>
          </div>
          <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {engineLabel && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
                background: '#EEF2FF', border: '1px solid #C7D2FE', borderRadius: 8, fontSize: 11.5, color: '#3730A3' }}>
                <Brain size={14} /> {engineLabel}
              </div>
            )}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nom du projet</label>
                <input className="form-input" value={extracted.projectName ?? ''} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Code projet</label>
                <input className="form-input" value={extracted.projectCode ?? 'AUTO-' + Date.now().toString(36).toUpperCase()} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Budget estimé</label>
                <input className="form-input" value={`${(extracted.budget ?? 0).toLocaleString('fr-FR')} ${extracted.currency ?? 'FCFA'}`} readOnly />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Début</label>
                <input className="form-input" value={extracted.startDate ?? ''} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Fin prévue</label>
                <input className="form-input" value={extracted.endDate ?? ''} readOnly />
              </div>
              <div className="form-group">
                <label className="form-label">Contractant</label>
                <input className="form-input" value={extracted.contractor ?? 'À définir'} readOnly />
              </div>
            </div>

            {extracted.wbsItems && extracted.wbsItems.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>WBS suggérée</div>
                <div className="table-responsive">
                  <table className="tbl">
                    <thead><tr><th>Code</th><th>Libellé</th><th>Budget %</th></tr></thead>
                    <tbody>
                      {extracted.wbsItems.map((w, i) => (
                        <tr key={i}><td>{w.code}</td><td>{w.label}</td><td>{w.budget}%</td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {extracted.risks && extracted.risks.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>Risques détectés</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {extracted.risks.map((r, i) => (
                    <div key={i} className={`badge badge-${r.severity === 'haute' ? 'danger' : r.severity === 'moyenne' ? 'warning' : 'neutral'}`}>
                      {r.description}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {immos.length > 0 && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 6 }}>
                  🏢 Immobilisations identifiées — handover DAIC (amortissements) · {immos.length}
                </div>
                <div className="table-responsive">
                  <table className="tbl">
                    <thead><tr><th>Code</th><th>Désignation</th><th>Catégorie</th><th>Durée amort.</th><th>Mise en service</th></tr></thead>
                    <tbody>
                      {immos.map((im, i) => (
                        <tr key={i}>
                          <td>{im.code}</td><td>{im.designation}</td><td>{im.categorie}</td>
                          <td>{im.duree_amortissement} ans</td><td>{im.date_mise_en_service || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                  Identifiées par l'agent comptable « immobilisations » du swarm — transmissibles à la DAIC à la clôture.
                </div>
              </div>
            )}
          </div>
          <div className="card-footer" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button className="btn btn-secondary" onClick={() => setStep(1)}>
              <ChevronLeft size={14} /> Retour analyse
            </button>
            <button className="btn btn-primary" onClick={() => setStep(3)}>
              Valider et continuer <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* ── STEP 4 : VALIDATE ── */}
      {step === 3 && extracted && !existingMatch && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><CheckCircle size={14} /> Validation humaine</span>
          </div>
          <div className="card-body" style={{ textAlign: 'center', padding: 32 }}>
            <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>
              L'IA a préparé le projet <strong>{extracted.projectName}</strong> avec une confiance de {computeConfidence(extracted)}%.
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: multiLots ? 14 : 24 }}>
              Aucun projet existant ne correspond au code <strong>{extracted.projectCode || '—'}</strong> : un <strong>nouveau projet</strong> sera créé. Vous pourrez le modifier ensuite.
            </div>

            {/* ── Multi-lots détectés ── */}
            {multiLots && (
              <div style={{ textAlign: 'left', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: 14, marginBottom: 18 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1E40AF', marginBottom: 8 }}>
                  📦 {extracted.lots!.length} lots détectés dans le dossier
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
                  {extracted.lots!.map(l => (
                    <div key={l.numero} style={{ fontSize: 12, color: '#334155', display: 'flex', gap: 8 }}>
                      <span style={{ fontWeight: 700, minWidth: 54 }}>Lot {l.numero}</span>
                      <span style={{ flex: 1 }}>{l.label}</span>
                      {l.budget ? <span style={{ color: '#16A34A', fontWeight: 700 }}>{(l.budget / 1_000_000).toFixed(0)} M</span> : null}
                    </div>
                  ))}
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
                  <input type="checkbox" checked={creerParLot} onChange={e => setCreerParLot(e.target.checked)} />
                  Créer <strong>chaque lot comme sous-projet séparé</strong> (rattachés à un projet parent, <strong>consolidables</strong>). Décochez pour un seul projet global.
                </label>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => validateProject(false)}>
                <RefreshCw size={14} /> Refaire l'analyse
              </button>
              <button className="btn btn-primary" onClick={() => validateProject(true)}>
                <CheckCircle size={14} /> {multiLots && creerParLot ? `Créer ${extracted.lots!.length} sous-projets` : 'Valider et créer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 4 (variante) : MISE À JOUR human-in-the-loop d'un projet existant ── */}
      {step === 3 && extracted && existingMatch && (
        <div className="card">
          <div className="card-header">
            <span className="card-title"><RefreshCw size={14} /> Mise à jour d'un projet existant — validation humaine</span>
          </div>
          <div className="card-body" style={{ padding: 24 }}>
            <div className="banner" style={{ marginBottom: 16, background: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1E40AF', padding: '10px 14px', borderRadius: 8, fontSize: 12.5 }}>
              📌 Le document porte le code <strong>{extracted.projectCode}</strong>, déjà présent dans la plateforme :
              <strong> {existingMatch.code} — {existingMatch.nom}</strong>. Sélectionnez les informations à mettre à jour.
            </div>

            {proposedDiff.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-muted)', fontSize: 13 }}>
                ✅ Aucune différence détectée entre le document et le projet existant. Rien à mettre à jour.
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '2px solid #E2E8F0', color: '#64748B' }}>
                      <th style={{ padding: '8px 6px', width: 34 }}></th>
                      <th style={{ padding: '8px 6px' }}>Champ</th>
                      <th style={{ padding: '8px 6px' }}>Valeur actuelle</th>
                      <th style={{ padding: '8px 6px' }}>→ Nouvelle valeur (document)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {proposedDiff.map(r => (
                      <tr key={r.key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                        <td style={{ padding: '8px 6px', textAlign: 'center' }}>
                          <input type="checkbox" checked={acceptedFields[r.key] ?? true}
                            onChange={e => setAcceptedFields(prev => ({ ...prev, [r.key]: e.target.checked }))} />
                        </td>
                        <td style={{ padding: '8px 6px', fontWeight: 600 }}>{r.label}</td>
                        <td style={{ padding: '8px 6px', color: '#94A3B8', textDecoration: acceptedFields[r.key] ? 'line-through' : 'none' }}>{String(r.current ?? '—')}</td>
                        <td style={{ padding: '8px 6px', color: '#16A34A', fontWeight: 700 }}>{String(r.next)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 20 }}>
              <button className="btn btn-secondary" onClick={() => validateProject(false)}>
                <RefreshCw size={14} /> Refaire l'analyse
              </button>
              <button className="btn btn-primary" onClick={() => validateProject(true)}>
                <CheckCircle size={14} /> Appliquer la mise à jour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── STEP 5 : FINALIZE ── */}
      {step === 4 && (
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: 40 }}>
            <Rocket size={48} style={{ color: 'var(--success)', margin: '0 auto 16px' }} />
            <div style={{ fontSize: 18, fontWeight: 700 }}>{existingMatch ? 'Projet mis à jour dans SIGEPP !' : 'Projet généré dans SIGEPP !'}</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 20 }}>
              Dashboard • Planning Gantt • WBS • Budget • Marchés • GED • Risques • Reporting
            </div>
            {((extracted?.wbsItems?.length ?? 0) > 0 || (extracted?.lots?.length ?? 0) > 0) && (
              <div style={{ fontSize: 12.5, color: 'var(--text)', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 9, padding: '10px 14px', margin: '0 auto 18px', maxWidth: 460 }}>
                🧱 <strong>Structuration des actifs générée par l’IA</strong> à partir du bordereau —
                Composant → Sous-composant → Article. À valider, puis immobiliser.
              </div>
            )}
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-secondary" onClick={() => router.push('/projets')}>
                <FolderOpen size={14} /> Voir les projets
              </button>
              <button className="btn btn-secondary" onClick={() => router.push('/structuration')}>
                <FilePlus size={14} /> Structuration des actifs
              </button>
              <button className="btn btn-primary" onClick={finalizeProject}>
                <Rocket size={14} /> Ouvrir le projet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function inferDocType(filename: string, mime: string): MigrationDocument['type'] {
  const n = filename.toLowerCase();
  if (n.includes('contrat') || n.includes('contract')) return 'contract';
  if (n.includes('dao') || n.includes('cctp')) return 'dao';
  if (n.includes('bq') || n.includes('devis') || n.includes('budget')) return 'boq';
  if (n.includes('rapport') || n.includes('report')) return 'report';
  if (n.includes('pv') || n.includes('reception')) return 'pv';
  if (n.includes('plan') || n.includes('drawing')) return 'plan';
  if (n.includes('photo') || mime.startsWith('image/')) return 'photo';
  if (n.endsWith('.xls') || n.endsWith('.xlsx')) return 'excel';
  if (n.endsWith('.pdf')) return 'pdf';
  if (n.endsWith('.doc') || n.endsWith('.docx')) return 'word';
  return 'other';
}
