'use client';
/**
 * ZonesQuantites — Module Zones & Quantités d'un projet (SIGEPP-DPE).
 *
 * Couvre :
 *   #25 — séparation Zones (lignes géo) / Quantités (matrice zones × items),
 *          import Excel affichant TOUTES les colonnes + auto-mapping, items
 *          paramétrables selon le type de projet.
 *   #26 — BOQ (bordereau de quantités) agrégé pour les décomptes / IPC,
 *          cohérent avec les quantités VALIDÉES terrain.
 *   #27 — carte SIG auto-mise à jour à partir des coordonnées des zones,
 *          tout est persisté (localStorage via le store).
 *   #28 — filtre par lot construit dynamiquement à partir du contenu.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import * as XLSX from 'xlsx';
import {
  Plus, Trash2, Upload, Download, Printer, MapPin, Settings, RotateCcw,
  Save, Table2, Coins, Layers,
} from 'lucide-react';
import {
  useZonesStore, lotsFromZones, buildBOQ, normHeader, seedProjetData,
  type ZoneRow, type QtyItem, type StatutZone,
} from '@/lib/zonesQuantitesStore';
import { downloadExcel, printBranded, fmtNombre } from '@/lib/exportUtils';

const ProjetsCarteLeaflet = dynamic(() => import('@/components/ui/ProjetsCarteLeaflet'), {
  ssr: false,
  loading: () => (
    <div style={{ height: 320, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94A3B8', fontSize: 13 }}>
      Chargement de la carte SIG…
    </div>
  ),
});

const C = {
  navy: '#1B4F8A', orange: '#F47920', green: '#16A34A', red: '#EF3340',
  amber: '#D97706', purple: '#7B2FBE', border: '#E2E8F0', slate: '#64748B',
};

const STATUT_CFG: Record<StatutZone, { label: string; color: string; bg: string }> = {
  termine:     { label: 'Terminé',     color: '#16A34A', bg: '#DCFCE7' },
  en_cours:    { label: 'En cours',    color: '#1B4F8A', bg: '#EFF6FF' },
  non_demarre: { label: 'Non démarré', color: '#94A3B8', bg: '#F1F5F9' },
  suspendu:    { label: 'Suspendu',    color: '#D97706', bg: '#FFF7ED' },
};

type Sub = 'zones' | 'quantites' | 'boq' | 'carte' | 'parametres';

interface Props {
  projetCode: string;
  projetNom: string;
  projetDomaine: string;
  programme?: string;
  canEdit: boolean;
}

const slug = (s: string) => normHeader(s).slice(0, 24) || `item${Math.random().toString(36).slice(2, 6)}`;

/** Le projet relève-t-il du programme BEST / CPBM-UE (→ référentiel des 1041 localités) ? */
function isProjetBEST(programme?: string, nom?: string, code?: string): boolean {
  return /\b(best|cpbm|padaes)\b/i.test(`${programme ?? ''} ${nom ?? ''} ${code ?? ''}`);
}

export default function ZonesQuantites({ projetCode, projetNom, projetDomaine, programme, canEdit }: Props) {
  const store = useZonesStore();
  const data = useZonesStore(s => s.byProjet[projetCode]);
  const [sub, setSub] = useState<Sub>('zones');
  const [filterLot, setFilterLot] = useState<string>('Tous');
  const fileRef = useRef<HTMLInputElement>(null);
  const [importPreview, setImportPreview] = useState<null | {
    headers: string[];
    rows: string[][];
    mapping: Record<string, string>; // header -> role (code/localite/commune/dept/lot/lat/lng/statut/obs/qty:<key> or ignore)
  }>(null);

  // Amorçage à la première ouverture du projet. Pour un projet BEST/CPBM-UE, on charge
  // AUTOMATIQUEMENT le référentiel officiel des 1041 localités (au lieu de l'exemple).
  useEffect(() => {
    if (data) return; // déjà initialisé (persisté)
    if (isProjetBEST(programme, projetNom, projetCode)) {
      store.ensure(projetCode, false); // pas de zones d'exemple
      import('@/lib/zonesBEST').then(({ zonesBESTToRows }) =>
        store.setZones(projetCode, zonesBESTToRows() as ZoneRow[]));
    } else {
      store.ensure(projetCode, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projetCode, data]);

  const d = data ?? seedProjetData();
  const lots = useMemo(() => lotsFromZones(d.zones), [d.zones]);
  const zonesFiltered = useMemo(
    () => d.zones.filter(z => filterLot === 'Tous' || z.lot === filterLot),
    [d.zones, filterLot],
  );
  const zoneFilterFn = useMemo(
    () => (z: ZoneRow) => filterLot === 'Tous' || z.lot === filterLot,
    [filterLot],
  );
  const boq = useMemo(() => buildBOQ(d, zoneFilterFn), [d, zoneFilterFn]);

  /* ─── Carte SIG : pins dérivés des zones avec coordonnées (#27) ───────────── */
  const carteProjets = useMemo(() => {
    return d.zones
      .filter(z => typeof z.lat === 'number' && typeof z.lng === 'number')
      .map(z => {
        const men = d.quantites[z.id] ?? {};
        const totP = Object.values(men).reduce((s, c) => s + c.prevu, 0);
        const totR = Object.values(men).reduce((s, c) => s + c.realise, 0);
        return {
          id: z.id, nom: `${z.code} · ${z.localite}`, code: z.code,
          region: z.departement || projetNom, domaine: projetDomaine,
          statut: z.statut === 'termine' ? 'termine' : z.statut === 'en_cours' ? 'en_cours' : 'planifie',
          avancement: totP > 0 ? Math.round((totR / totP) * 100) : 0,
          budget: 0, localisation: z.commune || z.localite,
          lat: z.lat, lng: z.lng, refSIG: `SIG-${projetCode}-${z.code}`,
        };
      });
  }, [d.zones, d.quantites, projetCode, projetNom, projetDomaine]);

  const zonesAvecCoord = carteProjets.length;

  /* ─── Import Excel : lecture brute, TOUTES colonnes (#25) ─────────────────── */
  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const buf = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(buf, { type: 'array' });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const matrix = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, blankrows: false, defval: '' });
        if (!matrix.length) { alert('Fichier vide.'); return; }
        const headers = (matrix[0] as unknown[]).map(h => String(h ?? '').trim());
        const rows = matrix.slice(1).map(r => headers.map((_, i) => String((r as unknown[])[i] ?? '').trim()));
        setImportPreview({ headers, rows, mapping: autoMap(headers) });
      } catch {
        alert('Lecture du fichier impossible. Vérifiez le format (.xlsx / .csv).');
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = '';
  }

  function autoMap(headers: string[]): Record<string, string> {
    const m: Record<string, string> = {};
    headers.forEach(h => {
      const n = normHeader(h);
      if (!n) { m[h] = 'ignore'; return; }
      if (/(^|_)(code|id|ref)$/.test(n) || n === 'code' || n === 'codezone' || n.includes('quatier') || n.includes('quartier')) m[h] = 'code';
      else if (n.includes('localit') || n.includes('village') || n.includes('site') || n.includes('zone') && !n.includes('code')) m[h] = 'localite';
      else if (n.includes('cacrv')) m[h] = 'cacrv';
      else if (n.includes('commune')) m[h] = 'commune';
      else if (n === 'cav' || n.includes('arrond')) m[h] = 'cav';
      else if (n.includes('region')) m[h] = 'region';
      else if (n.includes('depart')) m[h] = 'departement';
      else if (n.includes('allot') || n.includes('lot') || n.includes('tranche')) m[h] = 'lot';
      else if (n === 'lat' || n.includes('latitude')) m[h] = 'lat';
      else if (n === 'lng' || n === 'lon' || n.includes('longitude')) m[h] = 'lng';
      else if (n.includes('statut') || n.includes('etat')) m[h] = 'statut';
      else if (n.includes('observ') || n.includes('commentaire') || n.includes('remarque')) m[h] = 'obs';
      else m[h] = 'ignore'; // l'utilisateur décidera si c'est une quantité
    });
    return m;
  }

  function parseNum(s: string): number {
    const v = parseFloat(String(s).replace(/\s/g, '').replace(',', '.').replace(/[^0-9.\-]/g, ''));
    return isNaN(v) ? 0 : v;
  }

  function detectStatut(s: string): StatutZone {
    const n = normHeader(s);
    if (n.includes('termin') || n.includes('acheve') || n.includes('recept')) return 'termine';
    if (n.includes('cours') || n.includes('encours')) return 'en_cours';
    if (n.includes('suspend') || n.includes('arret')) return 'suspendu';
    return 'non_demarre';
  }

  function applyImport() {
    if (!importPreview) return;
    const { headers, rows, mapping } = importPreview;
    // Colonnes quantités = celles mappées en "qty"
    const qtyHeaders = headers.filter(h => mapping[h] === 'qty');
    const items: QtyItem[] = qtyHeaders.length
      ? qtyHeaders.map(h => ({ key: slug(h), label: h, unite: 'U', prixUnitaire: 0 }))
      : d.items;

    const zones: ZoneRow[] = [];
    const quantites: Record<string, Record<string, { prevu: number; realise: number; valide: number }>> = {};
    rows.forEach((r, idx) => {
      const get = (role: string) => {
        const hi = headers.findIndex(h => mapping[h] === role);
        return hi >= 0 ? r[hi] : '';
      };
      const code = get('code') || `Z${String(idx + 1).padStart(2, '0')}`;
      const localite = get('localite');
      if (!localite && !get('code')) return; // ligne vide
      const id = `z${Date.now()}_${idx}`;
      const latS = get('lat'), lngS = get('lng');
      const cacrv = get('cacrv');
      zones.push({
        id, code, localite,
        region: get('region') || undefined,
        departement: get('departement'),
        cav: get('cav') || undefined,
        cacrv: cacrv || undefined,
        commune: get('commune') || cacrv,
        lot: get('lot') || 'Lot 1',
        lat: latS ? parseNum(latS) : undefined,
        lng: lngS ? parseNum(lngS) : undefined,
        statut: get('statut') ? detectStatut(get('statut')) : 'non_demarre',
        observation: get('obs'),
      });
      quantites[id] = {};
      qtyHeaders.forEach(h => {
        const prevu = parseNum(r[headers.indexOf(h)]);
        quantites[id][slug(h)] = { prevu, realise: 0, valide: 0 };
      });
    });
    store.replaceProjet(projetCode, { zones, items, quantites });
    setImportPreview(null);
    setFilterLot('Tous');
    setSub('zones');
  }

  /* ─── Export Excel multi-feuilles (Zones + Quantités + BOQ) ───────────────── */
  function exportExcel() {
    const zonesSheet = {
      sheetName: 'Zones',
      title: `Zones d'intervention — ${projetCode}`,
      subtitle: `${d.zones.length} zones · ${projetNom}`,
      headers: ['Code', 'Localité', 'Commune', 'Département', 'Lot', 'Latitude', 'Longitude', 'Statut', 'Observation'],
      rows: d.zones.map(z => [z.code, z.localite, z.commune, z.departement, z.lot, z.lat ?? '', z.lng ?? '', STATUT_CFG[z.statut].label, z.observation]),
    };
    const qtyHeaders = ['Code', 'Localité', 'Lot', ...d.items.flatMap(i => [`${i.label} prévu (${i.unite})`, `${i.label} réalisé`, `${i.label} validé`])];
    const qtySheet = {
      sheetName: 'Quantités',
      title: `Matrice des quantités — ${projetCode}`,
      headers: qtyHeaders,
      rows: d.zones.map(z => [
        z.code, z.localite, z.lot,
        ...d.items.flatMap(i => {
          const c = d.quantites[z.id]?.[i.key] ?? { prevu: 0, realise: 0, valide: 0 };
          return [c.prevu, c.realise, c.valide];
        }),
      ]),
    };
    const boqSheet = {
      sheetName: 'BOQ-IPC',
      title: `BOQ — base décompte / IPC — ${projetCode}`,
      subtitle: filterLot === 'Tous' ? 'Tous lots' : filterLot,
      headers: ['Item', 'Unité', 'Prix unitaire (FCFA)', 'Prévu', 'Réalisé', 'Validé', 'Montant validé (FCFA)', '% validé'],
      rows: boq.map(b => [b.label, b.unite, b.prixUnitaire, b.prevu, b.realise, b.valide, b.montantValide, b.pctValide]),
    };
    downloadExcel(`zones_quantites_${projetCode}`, [zonesSheet, qtySheet, boqSheet]);
  }

  function printBOQ() {
    const totalValide = boq.reduce((s, b) => s + b.montantValide, 0);
    printBranded({
      title: 'BOQ — Bordereau de Quantités (base IPC)',
      subtitle: `${projetCode} · ${projetNom}${filterLot !== 'Tous' ? ` · ${filterLot}` : ''}`,
      landscape: true,
      tables: [{
        title: 'Quantités validées terrain → Interim Payment Certificate',
        headers: ['Item', 'Unité', 'P.U. (FCFA)', 'Prévu', 'Réalisé', 'Validé', 'Montant validé (FCFA)', '% validé'],
        rightAlign: [2, 3, 4, 5, 6, 7],
        rows: boq.map(b => [b.label, b.unite, fmtNombre(b.prixUnitaire), fmtNombre(b.prevu, 1), fmtNombre(b.realise, 1), fmtNombre(b.valide, 1), fmtNombre(b.montantValide), `${b.pctValide}%`]),
      }],
      bodyHTML: `<div style="margin-top:14px;text-align:right;font-size:13px;font-weight:800;color:#0E3460">
        Montant total validé (base décompte) : ${fmtNombre(totalValide)} FCFA</div>`,
      confidentiel: true,
    });
  }

  /* ─── Édition zone (inline modal léger) ───────────────────────────────────── */
  const [zoneEdit, setZoneEdit] = useState<ZoneRow | null>(null);
  function blankZone(): ZoneRow {
    return { id: `z${Date.now()}`, code: `Z${String(d.zones.length + 1).padStart(2, '0')}`, localite: '', commune: '', departement: '', lot: lots[0] ?? 'Lot 1', statut: 'non_demarre', observation: '' };
  }

  /* ─── Item (colonne quantité) édition ─────────────────────────────────────── */
  const [newItem, setNewItem] = useState<{ label: string; unite: string; prix: string }>({ label: '', unite: 'U', prix: '0' });

  const SUBS: { key: Sub; label: string; icon: React.ReactNode }[] = [
    { key: 'zones',      label: 'Zones',           icon: <MapPin size={13} /> },
    { key: 'quantites',  label: 'Quantités',       icon: <Table2 size={13} /> },
    { key: 'boq',        label: 'BOQ / IPC',       icon: <Coins size={13} /> },
    { key: 'carte',      label: `Carte SIG (${zonesAvecCoord})`, icon: <Layers size={13} /> },
    ...(canEdit ? [{ key: 'parametres' as Sub, label: 'Items & prix', icon: <Settings size={13} /> }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {SUBS.map(t => (
          <button key={t.key} onClick={() => setSub(t.key)}
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
              border: `1px solid ${sub === t.key ? C.navy : C.border}`, background: sub === t.key ? C.navy : '#fff', color: sub === t.key ? '#fff' : C.slate }}>
            {t.icon} {t.label}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        {canEdit && (
          <>
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" onChange={onPickFile} style={{ display: 'none' }} />
            <button onClick={() => fileRef.current?.click()} style={ghostBtn(C.purple)}><Upload size={12} /> Importer Excel</button>
          </>
        )}
        <button onClick={exportExcel} style={ghostBtn(C.navy)}><Download size={12} /> Export Excel</button>
      </div>

      {/* Filtre par lot — dynamique d'après le contenu (#28) */}
      {lots.length > 0 && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 11, color: C.slate, fontWeight: 700 }}>Lots détectés :</span>
          {['Tous', ...lots].map(l => (
            <button key={l} onClick={() => setFilterLot(l)}
              style={{ padding: '4px 11px', borderRadius: 99, fontSize: 11, fontWeight: 700, cursor: 'pointer',
                border: `1px solid ${filterLot === l ? C.orange : C.border}`, background: filterLot === l ? `${C.orange}15` : '#fff', color: filterLot === l ? C.orange : C.slate }}>
              {l}{l !== 'Tous' ? ` (${d.zones.filter(z => z.lot === l).length})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Bandeau import preview */}
      {importPreview && (
        <ImportPreviewPanel
          preview={importPreview}
          onChangeMapping={(h, role) => setImportPreview(p => p ? { ...p, mapping: { ...p.mapping, [h]: role } } : p)}
          onCancel={() => setImportPreview(null)}
          onApply={applyImport}
        />
      )}

      {/* ─── ZONES ─────────────────────────────────────────────────────────── */}
      {sub === 'zones' && (
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, flex: 1 }}>📍 Zones d&apos;intervention — {zonesFiltered.length} affichée(s)</span>
            {canEdit && (
              <button
                onClick={async () => {
                  // Lazy-load du référentiel (220 Ko) : chargé uniquement au clic, hors bundle principal.
                  const { zonesBESTToRows } = await import('@/lib/zonesBEST');
                  const cible = filterLot === 'Tous' ? undefined : filterLot;
                  const rows = zonesBESTToRows(cible);
                  if (d.zones.length && !window.confirm(
                    `Charger les ${rows.length} localités BEST${cible ? ` (${cible})` : ' (1041)'} ? Cela remplace les zones actuelles de ${projetCode}.`
                  )) return;
                  store.setZones(projetCode, rows as ZoneRow[]);
                }}
                title="Importer le référentiel officiel des 1041 localités du Programme BEST"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 7, border: `1px solid ${C.navy}`, background: '#fff', color: C.navy, fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                <MapPin size={12} /> Charger 1041 BEST
              </button>
            )}
            {canEdit && <button onClick={() => setZoneEdit(blankZone())} style={primaryBtn}><Plus size={12} /> Ajouter zone</button>}
          </div>
          {/* Scroll horizontal ET vertical — en-tête figé (sticky) */}
          <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '62vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5, whiteSpace: 'nowrap' }}>
              <thead>
                <tr>
                  {['Code', 'Région', 'Département', 'Arrond. (CAV)', 'Commune (CACRV)', 'Localité', 'Latitude', 'Longitude', 'Lot', 'Statut', 'Observation', ...(canEdit ? ['Actions'] : [])].map((h, i) => (
                    <th key={i} style={{ ...thStyle, position: 'sticky', top: 0, zIndex: 2, background: '#EAEFF6' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {zonesFiltered.map((z, i) => (
                  <tr key={z.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={{ ...tdStyle, fontWeight: 800, color: C.navy }}>{z.code}</td>
                    <td style={tdStyle}>{z.region || '—'}</td>
                    <td style={tdStyle}>{z.departement || '—'}</td>
                    <td style={tdStyle}>{z.cav || '—'}</td>
                    <td style={tdStyle}>{z.cacrv || z.commune || '—'}</td>
                    <td style={{ ...tdStyle, fontWeight: 600 }}>{z.localite}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10.5 }}>{typeof z.lat === 'number' ? <span style={{ color: C.green }}>{z.lat.toFixed(6)}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    <td style={{ ...tdStyle, fontFamily: 'monospace', fontSize: 10.5 }}>{typeof z.lng === 'number' ? <span style={{ color: C.green }}>{z.lng.toFixed(6)}</span> : <span style={{ color: '#CBD5E1' }}>—</span>}</td>
                    <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 4, background: '#EFF6FF', color: C.navy }}>{z.lot}</span></td>
                    <td style={tdStyle}><span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99, background: STATUT_CFG[z.statut].bg, color: STATUT_CFG[z.statut].color }}>{STATUT_CFG[z.statut].label}</span></td>
                    <td style={{ ...tdStyle, color: C.slate, fontSize: 10.5, maxWidth: 220, whiteSpace: 'normal' }}>{z.observation || '—'}</td>
                    {canEdit && (
                      <td style={tdStyle}>
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button onClick={() => setZoneEdit(z)} style={miniBtn(C.navy)}>Modifier</button>
                          <button onClick={() => { if (confirm(`Supprimer ${z.code} ?`)) store.removeZone(projetCode, z.id); }} style={miniBtn(C.red)}><Trash2 size={11} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {zonesFiltered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 12 }}>Aucune zone. Importez un fichier Excel ou ajoutez une zone.</div>}
          </div>
        </div>
      )}

      {/* ─── QUANTITÉS (matrice zones × items) ─────────────────────────────── */}
      {sub === 'quantites' && (
        <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, fontSize: 12, fontWeight: 700, color: C.navy }}>
            🧮 Matrice des quantités — zones en lignes, items en colonnes (P=prévu · R=réalisé · V=validé terrain)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: `${C.navy}06` }}>
                  <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F1F6FB', zIndex: 2 }}>Zone</th>
                  {d.items.map(it => (
                    <th key={it.key} colSpan={3} style={{ ...thStyle, textAlign: 'center', borderLeft: `2px solid ${C.border}` }}>{it.label}<br /><span style={{ fontSize: 9, color: C.slate, fontWeight: 600 }}>({it.unite})</span></th>
                  ))}
                </tr>
                <tr style={{ background: `${C.navy}03` }}>
                  <th style={{ ...thStyle, position: 'sticky', left: 0, background: '#F8FAFC', zIndex: 2 }}></th>
                  {d.items.flatMap(it => ['P', 'R', 'V'].map((s, k) => (
                    <th key={it.key + s} style={{ ...thStyle, textAlign: 'center', fontSize: 9, borderLeft: k === 0 ? `2px solid ${C.border}` : 'none', color: s === 'V' ? C.green : C.slate }}>{s}</th>
                  )))}
                </tr>
              </thead>
              <tbody>
                {zonesFiltered.map((z, i) => (
                  <tr key={z.id} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#FAFAFA' : '#fff' }}>
                    <td style={{ ...tdStyle, position: 'sticky', left: 0, background: i % 2 ? '#FAFAFA' : '#fff', fontWeight: 700 }}>
                      <span style={{ color: C.navy }}>{z.code}</span> <span style={{ color: C.slate, fontWeight: 400 }}>{z.localite}</span>
                    </td>
                    {d.items.flatMap(it => {
                      const c = d.quantites[z.id]?.[it.key] ?? { prevu: 0, realise: 0, valide: 0 };
                      return (['prevu', 'realise', 'valide'] as const).map((field, k) => (
                        <td key={it.key + field} style={{ ...tdStyle, textAlign: 'center', borderLeft: k === 0 ? `2px solid ${C.border}` : 'none', padding: '4px 4px' }}>
                          {canEdit ? (
                            <input type="number" value={c[field] || ''} onChange={e => store.setQty(projetCode, z.id, it.key, { [field]: parseFloat(e.target.value) || 0 })}
                              style={{ width: 54, padding: '3px 4px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10.5, textAlign: 'right', color: field === 'valide' ? C.green : '#1E293B', fontWeight: field === 'valide' ? 700 : 400, fontFamily: 'inherit' }} />
                          ) : (
                            <span style={{ color: field === 'valide' ? C.green : '#1E293B', fontWeight: field === 'valide' ? 700 : 400 }}>{c[field]}</span>
                          )}
                        </td>
                      ));
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr style={{ background: `${C.navy}0A`, fontWeight: 800 }}>
                  <td style={{ ...tdStyle, position: 'sticky', left: 0, background: '#EEF4FA', color: C.navy }}>TOTAL</td>
                  {d.items.flatMap(it => (['prevu', 'realise', 'valide'] as const).map((field, k) => {
                    const tot = zonesFiltered.reduce((s, z) => s + (d.quantites[z.id]?.[it.key]?.[field] ?? 0), 0);
                    return <td key={it.key + field} style={{ ...tdStyle, textAlign: 'center', borderLeft: k === 0 ? `2px solid ${C.border}` : 'none', color: field === 'valide' ? C.green : C.navy }}>{fmtNombre(tot, tot % 1 ? 1 : 0)}</td>;
                  }))}
                </tr>
              </tfoot>
            </table>
            {zonesFiltered.length === 0 && <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8', fontSize: 12 }}>Aucune zone à quantifier.</div>}
          </div>
        </div>
      )}

      {/* ─── BOQ / IPC ─────────────────────────────────────────────────────── */}
      {sub === 'boq' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: `linear-gradient(135deg, ${C.navy}08, ${C.navy}14)`, borderRadius: 10, border: `1px solid ${C.navy}20`, padding: '12px 16px', fontSize: 11.5, color: C.slate, lineHeight: 1.6 }}>
            💰 <strong style={{ color: C.navy }}>BOQ — base Interim Payment Certificate.</strong> Les montants sont calculés sur la quantité <strong style={{ color: C.green }}>VALIDÉE terrain</strong> (cohérence terrain ↔ fournitures), filtrés par lot le cas échéant.
          </div>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, flex: 1 }}>Bordereau {filterLot !== 'Tous' ? `— ${filterLot}` : '— tous lots'}</span>
              <button onClick={printBOQ} style={ghostBtn(C.orange)}><Printer size={12} /> Imprimer / PDF</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
                <thead>
                  <tr style={{ background: `${C.navy}06` }}>
                    {['Item', 'Unité', 'P.U. (FCFA)', 'Prévu', 'Réalisé', 'Validé', 'Montant validé', '% validé'].map((h, i) => (
                      <th key={h} style={{ ...thStyle, textAlign: i >= 2 ? 'right' : 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {boq.map((b, i) => (
                    <tr key={b.key} style={{ borderBottom: '1px solid #F1F5F9', background: i % 2 ? '#FAFAFA' : '#fff' }}>
                      <td style={{ ...tdStyle, fontWeight: 700, color: '#1E293B' }}>{b.label}</td>
                      <td style={tdStyle}>{b.unite}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNombre(b.prixUnitaire)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNombre(b.prevu, b.prevu % 1 ? 1 : 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtNombre(b.realise, b.realise % 1 ? 1 : 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 800, color: C.green }}>{fmtNombre(b.valide, b.valide % 1 ? 1 : 0)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: C.navy, fontFamily: 'monospace' }}>{fmtNombre(b.montantValide)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: b.pctValide >= 100 ? '#DCFCE7' : b.pctValide > 0 ? '#FFF7ED' : '#F1F5F9', color: b.pctValide >= 100 ? C.green : b.pctValide > 0 ? C.amber : C.slate }}>{b.pctValide}%</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr style={{ background: `${C.navy}0A`, fontWeight: 800 }}>
                    <td style={{ ...tdStyle, color: C.navy }} colSpan={6}>MONTANT TOTAL VALIDÉ (base décompte / IPC)</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: C.navy, fontFamily: 'monospace', fontSize: 13 }}>{fmtNombre(boq.reduce((s, b) => s + b.montantValide, 0))}</td>
                    <td style={tdStyle}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── CARTE SIG ─────────────────────────────────────────────────────── */}
      {sub === 'carte' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11.5, color: C.slate, padding: '8px 12px', background: '#ECFDF5', borderRadius: 8, border: `1px solid ${C.green}30` }}>
            🛰️ <strong style={{ color: C.green }}>Carte SIG auto-mise à jour.</strong> {zonesAvecCoord} zone(s) géolocalisée(s) sur {d.zones.length}. Chargez les coordonnées (colonnes <em>Latitude/Longitude</em>) via l&apos;import Excel — les points apparaissent automatiquement et sont sauvegardés.
          </div>
          {zonesAvecCoord > 0 ? (
            <ProjetsCarteLeaflet projets={carteProjets as never} height={420} />
          ) : (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', color: '#94A3B8', fontSize: 12, background: '#fff', borderRadius: 10, border: `1px dashed ${C.border}` }}>
              Aucune zone géolocalisée. Ajoutez des coordonnées (Latitude/Longitude) aux zones pour alimenter la carte SIG.
            </div>
          )}
        </div>
      )}

      {/* ─── PARAMÈTRES : items & prix (#25/#26) ───────────────────────────── */}
      {sub === 'parametres' && canEdit && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, flex: 1 }}>⚙️ Items de quantité (colonnes) — paramétrables selon le type de projet</span>
              <button onClick={() => { if (confirm('Réinitialiser les zones et quantités de ce projet (exemple) ?')) store.resetProjet(projetCode, true); }} style={ghostBtn(C.red)}><RotateCcw size={12} /> Réinitialiser</button>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11.5 }}>
              <thead><tr style={{ background: `${C.navy}06` }}>{['Libellé', 'Unité', 'Prix unitaire (FCFA)', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
              <tbody>
                {d.items.map(it => (
                  <tr key={it.key} style={{ borderBottom: '1px solid #F1F5F9' }}>
                    <td style={tdStyle}><input value={it.label} onChange={e => store.updateItem(projetCode, it.key, { label: e.target.value })} style={inp} /></td>
                    <td style={tdStyle}><input value={it.unite} onChange={e => store.updateItem(projetCode, it.key, { unite: e.target.value })} style={{ ...inp, width: 70 }} /></td>
                    <td style={tdStyle}><input type="number" value={it.prixUnitaire || ''} onChange={e => store.updateItem(projetCode, it.key, { prixUnitaire: parseFloat(e.target.value) || 0 })} style={{ ...inp, width: 140, textAlign: 'right' }} /></td>
                    <td style={tdStyle}><button onClick={() => { if (confirm(`Supprimer l'item « ${it.label} » ?`)) store.removeItem(projetCode, it.key); }} style={miniBtn(C.red)}><Trash2 size={11} /></button></td>
                  </tr>
                ))}
                <tr style={{ background: '#F8FAFC' }}>
                  <td style={tdStyle}><input placeholder="Nouvel item (ex. Supports béton)" value={newItem.label} onChange={e => setNewItem(v => ({ ...v, label: e.target.value }))} style={inp} /></td>
                  <td style={tdStyle}><input placeholder="U" value={newItem.unite} onChange={e => setNewItem(v => ({ ...v, unite: e.target.value }))} style={{ ...inp, width: 70 }} /></td>
                  <td style={tdStyle}><input type="number" placeholder="0" value={newItem.prix} onChange={e => setNewItem(v => ({ ...v, prix: e.target.value }))} style={{ ...inp, width: 140, textAlign: 'right' }} /></td>
                  <td style={tdStyle}>
                    <button onClick={() => {
                      if (!newItem.label.trim()) return;
                      store.addItem(projetCode, { key: slug(newItem.label), label: newItem.label.trim(), unite: newItem.unite || 'U', prixUnitaire: parseFloat(newItem.prix) || 0 });
                      setNewItem({ label: '', unite: 'U', prix: '0' });
                    }} style={primaryBtn}><Plus size={11} /> Ajouter</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 10.5, color: C.slate }}>Dernière mise à jour : {new Date(d.updatedAt).toLocaleString('fr-FR')}</div>
        </div>
      )}

      {/* Modal zone */}
      {zoneEdit && (
        <ZoneModal
          zone={zoneEdit}
          lots={lots}
          onCancel={() => setZoneEdit(null)}
          onSave={z => { store.upsertZone(projetCode, z); setZoneEdit(null); }}
        />
      )}
    </div>
  );
}

/* ─── Import preview panel ─────────────────────────────────────────────────── */
const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: 'ignore', label: '— ignorer —' },
  { value: 'code', label: 'Code zone' },
  { value: 'localite', label: 'Localité' },
  { value: 'region', label: 'Région' },
  { value: 'departement', label: 'Département' },
  { value: 'cav', label: 'Arrondissement (CAV)' },
  { value: 'cacrv', label: 'Commune (CACRV)' },
  { value: 'commune', label: 'Commune' },
  { value: 'lot', label: 'Lot / Allotissement' },
  { value: 'lat', label: 'Latitude' },
  { value: 'lng', label: 'Longitude' },
  { value: 'statut', label: 'Statut' },
  { value: 'obs', label: 'Observation' },
  { value: 'qty', label: '➕ Quantité (item)' },
];

function ImportPreviewPanel({ preview, onChangeMapping, onCancel, onApply }: {
  preview: { headers: string[]; rows: string[][]; mapping: Record<string, string> };
  onChangeMapping: (header: string, role: string) => void;
  onCancel: () => void;
  onApply: () => void;
}) {
  const { headers, rows, mapping } = preview;
  return (
    <div style={{ background: '#fff', borderRadius: 10, border: `2px solid ${C.purple}`, overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', background: `${C.purple}0C`, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: C.purple, flex: 1 }}>📥 Aperçu import — {headers.length} colonnes, {rows.length} lignes. Associez chaque colonne :</span>
        <button onClick={onCancel} style={ghostBtn(C.slate)}>Annuler</button>
        <button onClick={onApply} style={{ ...primaryBtn, background: C.purple }}><Save size={12} /> Importer</button>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: 360 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} style={{ padding: '6px 8px', borderBottom: `1px solid ${C.border}`, background: '#F8FAFC', textAlign: 'left', minWidth: 120, verticalAlign: 'top' }}>
                  <div style={{ fontWeight: 700, color: '#1E293B', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }} title={h}>{h || `Col ${i + 1}`}</div>
                  <select value={mapping[h] ?? 'ignore'} onChange={e => onChangeMapping(h, e.target.value)}
                    style={{ width: '100%', padding: '3px 4px', border: `1px solid ${C.border}`, borderRadius: 4, fontSize: 10.5, fontFamily: 'inherit', color: mapping[h] === 'qty' ? C.purple : mapping[h] === 'ignore' ? '#94A3B8' : C.navy, fontWeight: 700 }}>
                    {ROLE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 8).map((r, ri) => (
              <tr key={ri} style={{ background: ri % 2 ? '#FAFAFA' : '#fff' }}>
                {headers.map((h, ci) => (
                  <td key={ci} style={{ padding: '4px 8px', borderBottom: '1px solid #F1F5F9', color: mapping[h] === 'ignore' ? '#CBD5E1' : '#475569', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 160 }}>{r[ci]}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > 8 && <div style={{ padding: '6px 14px', fontSize: 10.5, color: C.slate }}>… et {rows.length - 8} autres lignes.</div>}
    </div>
  );
}

/* ─── Zone modal ───────────────────────────────────────────────────────────── */
function ZoneModal({ zone, lots, onCancel, onSave }: { zone: ZoneRow; lots: string[]; onCancel: () => void; onSave: (z: ZoneRow) => void }) {
  const [f, setF] = useState<ZoneRow>(zone);
  const set = (patch: Partial<ZoneRow>) => setF(v => ({ ...v, ...patch }));
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,24,39,0.45)', zIndex: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }} onClick={onCancel}>
      <div onClick={e => e.stopPropagation()} style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 16px 40px rgba(0,0,0,0.25)' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.border}`, fontSize: 14, fontWeight: 800, color: C.navy }}>{zone.localite ? `Modifier ${zone.code}` : 'Nouvelle zone'}</div>
        <div style={{ padding: 18, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {([['code', 'Code'], ['localite', 'Localité'], ['commune', 'Commune'], ['departement', 'Département']] as const).map(([k, l]) => (
            <label key={k} style={lblStyle}>{l}
              <input value={(f[k] as string) ?? ''} onChange={e => set({ [k]: e.target.value } as Partial<ZoneRow>)} style={inp} />
            </label>
          ))}
          <label style={lblStyle}>Lot
            <input list="lots-list" value={f.lot} onChange={e => set({ lot: e.target.value })} style={inp} />
            <datalist id="lots-list">{lots.map(l => <option key={l} value={l} />)}</datalist>
          </label>
          <label style={lblStyle}>Statut
            <select value={f.statut} onChange={e => set({ statut: e.target.value as StatutZone })} style={inp}>
              {(Object.keys(STATUT_CFG) as StatutZone[]).map(s => <option key={s} value={s}>{STATUT_CFG[s].label}</option>)}
            </select>
          </label>
          <label style={lblStyle}>Latitude
            <input type="number" step="0.0001" value={f.lat ?? ''} onChange={e => set({ lat: e.target.value ? parseFloat(e.target.value) : undefined })} style={inp} placeholder="14.7167" />
          </label>
          <label style={lblStyle}>Longitude
            <input type="number" step="0.0001" value={f.lng ?? ''} onChange={e => set({ lng: e.target.value ? parseFloat(e.target.value) : undefined })} style={inp} placeholder="-17.4677" />
          </label>
          <label style={{ ...lblStyle, gridColumn: '1 / -1' }}>Observation
            <textarea value={f.observation} onChange={e => set({ observation: e.target.value })} style={{ ...inp, minHeight: 60, resize: 'vertical' }} />
          </label>
        </div>
        <div style={{ padding: '12px 18px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onCancel} style={ghostBtn(C.slate)}>Annuler</button>
          <button onClick={() => onSave(f)} style={primaryBtn}><Save size={12} /> Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

/* ─── styles ───────────────────────────────────────────────────────────────── */
const thStyle: React.CSSProperties = { padding: '9px 10px', textAlign: 'left', fontWeight: 700, color: C.navy, fontSize: 10, textTransform: 'uppercase', letterSpacing: '.4px', whiteSpace: 'nowrap' };
const tdStyle: React.CSSProperties = { padding: '7px 10px', color: '#334155', verticalAlign: 'middle' };
const inp: React.CSSProperties = { width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 12, fontFamily: 'inherit', color: '#1E293B', outline: 'none' };
const lblStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, fontWeight: 700, color: '#475569' };
const primaryBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 7, border: 'none', background: C.navy, color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' };
function ghostBtn(color: string): React.CSSProperties {
  return { display: 'flex', alignItems: 'center', gap: 5, padding: '6px 11px', borderRadius: 7, border: `1px solid ${color}40`, background: `${color}0C`, color, fontSize: 11, fontWeight: 700, cursor: 'pointer' };
}
function miniBtn(color: string): React.CSSProperties {
  return { display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 8px', borderRadius: 5, border: `1px solid ${color}40`, background: '#fff', color, fontSize: 10, fontWeight: 700, cursor: 'pointer' };
}
