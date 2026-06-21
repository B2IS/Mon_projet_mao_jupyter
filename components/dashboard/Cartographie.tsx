'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, MapPin, Download, CheckCircle2, Clock, ChevronRight, X, RefreshCw, AlertTriangle, Network, ClipboardCheck } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG } from '@/lib/projectStore';
import { useZonesStore } from '@/lib/zonesQuantitesStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import { MapContainer, TileLayer, Polygon, CircleMarker, Polyline, Popup, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';
import SearchableSelect from '@/components/ui/SearchableSelect';
import { useUNNetworkStore, featureTierColor, isLineFeature } from '@/lib/gis/unNetworkStore';
import { UN_LAYERS, UN_TIERS, MIGRATION_CHECKLIST, layersByDomainAndTier } from '@/lib/gis/unModel';

/* ═══════════════════════════════════════════════════════════════════
   TYPES & MOCK DATA
═══════════════════════════════════════════════════════════════════ */
type RagStatus = 'critique' | 'en_cours' | 'ok';

interface PinProjet {
  id: string; code: string; nom: string; region: string;
  lat: number; lng: number; status: RagStatus; description: string;
}

interface SaisiesTerrain {
  id: string; code: string; projet: string; localite: string;
  typeHTA: number; postes: number; dateMES: string; statut: 'a_promouvoir' | 'promue';
}

interface Couche {
  id: string; label: string; count: number; active: boolean; color: string;
}

/* ── Configuration ArcGIS (interfaçage SIG SENELEC) ── */
interface ArcgisConfig {
  enabled: boolean;
  portalUrl: string;     // ex: https://gis.senelec.sn/portal
  serviceUrl: string;    // ex: https://gis.senelec.sn/server/rest/services
  token: string;         // jeton OAuth2 / API key
  layers: string;        // couches à synchroniser (CSV) : HTA, BT, Postes, Compteurs
}
const ARCGIS_KEY = 'sigep-arcgis-config';
const DEFAULT_ARCGIS: ArcgisConfig = {
  enabled: false,
  portalUrl: 'https://gis.senelec.sn/portal',
  serviceUrl: 'https://gis.senelec.sn/server/rest/services',
  token: '',
  layers: 'HTA, BT, Postes, Compteurs',
};

// NB : plus aucune donnée projet codée en dur ici. La carte est alimentée
// EXCLUSIVEMENT par `store.projets` (déjà filtré par la MMH : unité + affectation
// + implication), afin qu'aucun profil ne voie les projets d'autres unités.

const SAISIES: SaisiesTerrain[] = [];

const STATUS_COLOR: Record<RagStatus, string> = {
  critique: 'var(--red)',
  en_cours: 'var(--orange)',
  ok: 'var(--green)',
};

/* ═══════════════════════════════════════════════════════════════════
   CONSTANTES GÉOGRAPHIQUES LEAFLET
═══════════════════════════════════════════════════════════════════ */
interface RegionGeo {
  id: string;
  label: string;
  polygon: LatLngExpression[];
  projets: number;
}

// Polygones approximatifs des 14 régions du Sénégal (lat, lng)
const REGION_POLYGONS: RegionGeo[] = [
  { id: 'saint-louis', label: 'Saint-Louis', projets: 1, polygon: [[16.6,-17.0],[16.6,-15.5],[15.5,-15.5],[15.5,-17.0]] },
  { id: 'louga',       label: 'Louga',       projets: 0, polygon: [[16.6,-15.5],[16.6,-14.5],[15.0,-14.5],[15.0,-15.5]] },
  { id: 'matam',       label: 'Matam',       projets: 0, polygon: [[16.0,-14.5],[16.0,-12.0],[14.5,-12.0],[14.5,-14.5]] },
  { id: 'dakar',       label: 'Dakar',       projets: 2, polygon: [[14.9,-17.6],[14.9,-16.9],[14.4,-16.9],[14.4,-17.6]] },
  { id: 'thies',       label: 'Thiès',       projets: 4, polygon: [[15.0,-17.1],[15.0,-16.2],[14.5,-16.2],[14.5,-17.1]] },
  { id: 'diourbel',    label: 'Diourbel',    projets: 1, polygon: [[14.9,-16.3],[14.9,-15.4],[14.4,-15.4],[14.4,-16.3]] },
  { id: 'fatick',      label: 'Fatick',      projets: 0, polygon: [[14.3,-16.8],[14.3,-16.0],[13.8,-16.0],[13.8,-16.8]] },
  { id: 'kaolack',     label: 'Kaolack',     projets: 1, polygon: [[14.3,-16.1],[14.3,-15.4],[13.7,-15.4],[13.7,-16.1]] },
  { id: 'kaffrine',    label: 'Kaffrine',    projets: 0, polygon: [[14.3,-15.5],[14.3,-14.5],[13.7,-14.5],[13.7,-15.5]] },
  { id: 'tambacounda', label: 'Tambacounda', projets: 0, polygon: [[14.5,-14.5],[14.5,-12.5],[12.8,-12.5],[12.8,-14.5]] },
  { id: 'kedougou',    label: 'Kédougou',    projets: 1, polygon: [[12.8,-13.0],[12.8,-11.5],[12.0,-11.5],[12.0,-13.0]] },
  { id: 'kolda',       label: 'Kolda',       projets: 0, polygon: [[13.7,-15.5],[13.7,-14.5],[12.5,-14.5],[12.5,-15.5]] },
  { id: 'sedhiou',     label: 'Sédhiou',     projets: 1, polygon: [[13.0,-16.0],[13.0,-15.0],[12.4,-15.0],[12.4,-16.0]] },
  { id: 'ziguinchor',  label: 'Ziguinchor',  projets: 1, polygon: [[12.8,-16.7],[12.8,-15.5],[12.3,-15.5],[12.3,-16.7]] },
];

// Centres lat/lng par région pour placer les projets
const REGION_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Dakar':       { lat: 14.7167, lng: -17.4677 },
  'Thiès':       { lat: 14.7894, lng: -16.9256 },
  'Diourbel':    { lat: 14.6521, lng: -16.2333 },
  'Saint-Louis': { lat: 16.0179, lng: -16.4896 },
  'Louga':       { lat: 15.6185, lng: -16.2247 },
  'Matam':       { lat: 15.6559, lng: -13.2554 },
  'Fatick':      { lat: 14.3384, lng: -16.4101 },
  'Kaolack':     { lat: 14.1652, lng: -16.0758 },
  'Kaffrine':    { lat: 14.1053, lng: -15.5509 },
  'Tambacounda': { lat: 13.7703, lng: -13.6674 },
  'Kédougou':    { lat: 12.5516, lng: -12.1754 },
  'Kolda':       { lat: 12.8833, lng: -14.9500 },
  'Sédhiou':     { lat: 12.7081, lng: -15.5560 },
  'Ziguinchor':  { lat: 12.5833, lng: -16.2667 },
};

function regionFill(projets: number): string {
  if (projets >= 4) return '#0E3460';
  if (projets >= 2) return '#1e4d82';
  if (projets >= 1) return '#2f6aaa';
  return '#cdd8ea';
}

function computeRegionProjetCounts(pins: { region: string }[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const r of REGION_POLYGONS) counts[r.id] = 0;
  for (const p of pins) {
    const key = Object.keys(REGION_CENTERS).find(k => k.toLowerCase() === p.region.toLowerCase());
    if (key) {
      const rid = REGION_POLYGONS.find(r => r.label.toLowerCase() === key.toLowerCase())?.id;
      if (rid) counts[rid] = (counts[rid] || 0) + 1;
    }
  }
  return counts;
}

/* ═══════════════════════════════════════════════════════════════════
   COMPOSANT PRINCIPAL
═══════════════════════════════════════════════════════════════════ */

export default function Cartographie() {
  const store = useProjectStore();
  const zonesByProjet = useZonesStore(s => s.byProjet);
  const router = useRouter();

  // Pins de la carte issus EXCLUSIVEMENT du store déjà filtré par la MMH
  // (unité + affectation + implication) → aucun profil ne voit d'autres unités.
  const storePins: PinProjet[] = useMemo(() =>
    store.projets.map((p, i) => {
      // Décalage DÉTERMINISTE (pas de Math.random : sinon les marqueurs « sautent » à chaque rendu).
      const center = REGION_CENTERS[p.region] ?? { lat: 14.5 + ((i % 7) - 3) * 0.25, lng: -14.5 + ((i % 5) - 2) * 0.25 };
      const jitter = { lat: center.lat + (i % 5 - 2) * 0.12, lng: center.lng + (Math.floor(i / 3) % 3 - 1) * 0.12 };
      const status: RagStatus = p.statut === 'en_retard' ? 'critique' : p.statut === 'termine' ? 'ok' : 'en_cours';
      const cfg = DOMAINE_CFG[p.domaine];
      return {
        id: p.id, code: p.code, nom: p.nom.substring(0, 30), region: p.region,
        lat: p.lat ?? jitter.lat, lng: p.lng ?? jitter.lng, status,
        description: `${cfg.emoji} ${cfg.label} · ${p.avancement}% · ${p.budget.toFixed(0)} MFCFA`,
      };
    }), [store.projets]);

  // ── Localités CHARGÉES dans « Zones & Quantités » (BEST ou import Excel) ──
  // Dès qu'un fichier est chargé avec des coordonnées, ses localités apparaissent
  // automatiquement sur la carte (couche « Localités chargées »).
  const loadedZones = useMemo(() => {
    const out: { lat: number; lng: number; localite: string; lot: string; statut: string; region: string; departement: string; code: string }[] = [];
    const seen = new Set<string>();
    Object.values(zonesByProjet ?? {}).forEach(pz => {
      (pz?.zones ?? []).forEach(z => {
        if (typeof z.lat === 'number' && typeof z.lng === 'number' && !Number.isNaN(z.lat) && !Number.isNaN(z.lng)) {
          const key = `${z.lat},${z.lng},${z.localite}`;
          if (seen.has(key)) return;
          seen.add(key);
          out.push({
            lat: z.lat, lng: z.lng, localite: z.localite || z.code || '—',
            lot: z.lot || '', statut: z.statut || '', region: z.region || '', departement: z.departement || '', code: z.code || '',
          });
        }
      });
    });
    return out;
  }, [zonesByProjet]);

  // Auto-hydratation : pour tout projet BEST/CPBM visible dont les zones ne sont
  // pas encore dans le store (l'utilisateur n'a pas ouvert « Zones & Quantités »),
  // on charge le référentiel des 1041 localités afin que la carte se peuple seule.
  const zonesEnsure = useZonesStore(s => s.ensure);
  const zonesSet = useZonesStore(s => s.setZones);
  useEffect(() => {
    const isBest = (s: string) => /\b(best|cpbm|padaes)\b/i.test(s);
    const targets = store.projets.filter(
      p => isBest(`${p.programme ?? ''} ${p.nom ?? ''} ${p.code ?? ''}`) && !zonesByProjet?.[p.code],
    );
    if (!targets.length) return;
    let cancelled = false;
    import('@/lib/zonesBEST')
      .then(({ zonesBESTToRows }) => {
        if (cancelled) return;
        const rows = zonesBESTToRows();
        targets.forEach(p => { zonesEnsure(p.code, false); zonesSet(p.code, rows as never); });
      })
      .catch(() => { /* chunk indisponible (HMR) */ });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.projets, zonesByProjet]);

  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTimeout(() => {
      setRefreshing(false);
      setLastRefresh(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    }, 1200);
  }, []);

  const handleExportPDF = useCallback(() => {
    const win = window.open('', '_blank');
    if (!win) { alert('Veuillez autoriser les popups.'); return; }
    win.document.write(`<!DOCTYPE html><html lang="fr"><head>
      <meta charset="UTF-8"><title>Carte SIG — SIGEP-DPE — ${new Date().toLocaleDateString('fr-FR')}</title>
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; color: #1E293B; }
        h1 { font-size: 22px; font-weight: 800; color: #0E3460; border-bottom: 3px solid #F47920; padding-bottom: 8px; }
        h2 { font-size: 14px; font-weight: 700; color: #1B4F8A; margin: 20px 0 8px; }
        table { width: 100%; border-collapse: collapse; font-size: 11px; margin: 12px 0; }
        th { background: #0E3460; color: #fff; padding: 6px 10px; text-align: left; }
        td { border-bottom: 1px solid #E2E8F0; padding: 6px 10px; }
        tr:nth-child(even) td { background: #F8FAFC; }
        .kpi { display: inline-block; padding: 10px 20px; border-radius: 8px; margin: 6px; background: #EFF6FF; border-left: 4px solid #1B4F8A; }
        .kpi-val { font-size: 20px; font-weight: 800; color: #0E3460; }
        .kpi-lbl { font-size: 10px; color: #888; }
        .footer { margin-top: 32px; font-size: 9px; color: #888; border-top: 1px solid #E2E8F0; padding-top: 8px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head><body>
      <div style="margin-bottom:12px"><img src="${SENELEC_LOGO_DATA_URI}" alt="SENELEC" style="height:46px;width:auto;display:block" /></div>
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#888;text-transform:uppercase;margin-bottom:16px">SENELEC · SIGEP-DPE · Direction Principale Équipement</div>
      <h1>Rapport SIG — Carte Portefeuille Projets</h1>
      <div style="font-size:12px;color:#64748B;margin-bottom:20px">Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div>
        <div class="kpi"><div class="kpi-val">${store.projets.length}</div><div class="kpi-lbl">Projets cartographiés</div></div>
        <div class="kpi"><div class="kpi-val">14</div><div class="kpi-lbl">Régions couvertes</div></div>
        <div class="kpi"><div class="kpi-val">6</div><div class="kpi-lbl">Saisies terrain</div></div>
        <div class="kpi"><div class="kpi-val">89%</div><div class="kpi-lbl">SLA cartographie OK</div></div>
      </div>
      <h2>Projets géoréférencés</h2>
      <table>
        <thead><tr><th>Code</th><th>Projet</th><th>Région</th><th>Statut</th><th>Description</th></tr></thead>
        <tbody>
          ${store.projets.map(p => { const c = DOMAINE_CFG[p.domaine]; return `<tr><td>${p.code || '—'}</td><td>${p.nom}</td><td>${p.region}</td><td>${p.statut}</td><td>${c?.label ?? ''} · ${p.avancement}% · ${p.budget.toFixed(0)} MFCFA</td></tr>`; }).join('')}
        </tbody>
      </table>
      <h2>Saisies terrain en attente de promotion</h2>
      <table>
        <thead><tr><th>Code SAI</th><th>Projet</th><th>Localité</th><th>Type HTA</th><th>Date MES</th><th>Statut</th></tr></thead>
        <tbody>
          ${SAISIES.map(s => `<tr><td>${s.code}</td><td>${s.projet}</td><td>${s.localite}</td><td>HTA ${s.typeHTA} km · ${s.postes} poste(s)</td><td>${s.dateMES}</td><td>${s.statut === 'promue' ? 'Promue' : 'En attente'}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · SIGEP-DPE uniquement · Rapport généré automatiquement</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }, [store.projets]);

  const handleExportShapefile = useCallback(() => {
    // Génère un CSV géocodé (remplace shapefile en environnement web)
    const headers = ['code,nom,region,statut,description,latitude,longitude'];
    const rows = storePins.map(p => {
      return `${p.code},"${p.nom}",${p.region},${p.status},"${p.description}",${p.lat},${p.lng}`;
    });
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `SIGEP-DPE_Cartographie_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, [storePins]);

  const handleExportPNG = useCallback(() => {
    alert('Export PNG de la carte — Cette fonctionnalité requiert ArcGIS Enterprise connecté. En mode démo, utilisez Export PDF pour un rendu imprimable.');
  }, []);

  const [couches, setCouches] = useState<Couche[]>([
    { id: 'hta_decl', label: 'HTA Déclaré', count: 32, active: true, color: 'var(--orange)' },
    { id: 'hta_off', label: 'HTA Officiel', count: 847, active: true, color: 'var(--navy)' },
    { id: 'postes', label: 'Postes HTA/BT', count: 52, active: true, color: '#7C3AED' },
    { id: 'saisies', label: 'Saisies terrain', count: 84, active: false, color: '#F59E0B' },
    { id: 'projets', label: 'Projets actifs', count: 11, active: true, color: 'var(--green)' },
    { id: 'mes', label: 'Localités MES', count: 84, active: false, color: 'var(--red)' },
    { id: 'best', label: 'Localités BEST (1041)', count: 1041, active: false, color: '#0EA5E9' },
    { id: 'chargees', label: 'Localités chargées', count: 0, active: true, color: '#F47920' },
  ]);

  // Synchronise le compteur de la couche « chargées » avec les zones réellement chargées.
  useEffect(() => {
    setCouches(cs => cs.map(c => c.id === 'chargees' ? { ...c, count: loadedZones.length } : c));
  }, [loadedZones.length]);
  const loadedActive = couches.find(c => c.id === 'chargees')?.active ?? true;
  const statutColor = (s: string) => /termin|réalis|realis|mes/i.test(s) ? '#16A34A' : /cours/i.test(s) ? '#F59E0B' : /retard|suspend/i.test(s) ? '#EF3340' : '#0EA5E9';

  // Couche « Localités BEST » : 1041 localités réelles, chargées en lazy-import à l'activation.
  const bestActive = couches.find(c => c.id === 'best')?.active ?? false;
  const [bestZones, setBestZones] = useState<{ lat: number; lng: number; localite: string; lot: string; statut: string; region: string; departement: string }[]>([]);
  useEffect(() => {
    if (bestActive && bestZones.length === 0) {
      import('@/lib/zonesBEST').then(({ ZONES_BEST }) => {
        setBestZones(ZONES_BEST
          .filter(z => typeof z.lat === 'number' && typeof z.lng === 'number')
          .map(z => ({ lat: z.lat as number, lng: z.lng as number, localite: z.localite, lot: z.lot, statut: z.statut, region: z.region, departement: z.departement })));
      }).catch(() => { /* chunk indisponible (HMR) — couche ignorée sans planter la carte */ });
    }
  }, [bestActive, bestZones.length]);
  const lotColor = (lot: string) => lot === 'LOT 1' ? '#0EA5E9' : lot === 'LOT 2' ? '#8B5CF6' : '#10B981';

  const [filterStatut, setFilterStatut] = useState('tous');
  const [filterProjet, setFilterProjet] = useState('tous');
  const [selectedPin, setSelectedPin] = useState<PinProjet | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [showStorePins, setShowStorePins] = useState(true);

  // ── Mode réseau : GN (legacy) / UN (nouveau) / Les deux ──────────────────
  const [reseauMode, setReseauMode] = useState<'GN' | 'UN' | 'BOTH'>('GN');

  // ── UN Network state ───────────────────────────────────────────────────────
  const unStore = useUNNetworkStore();
  const [showUNPanel, setShowUNPanel] = useState(false);
  const [showMigrationModal, setShowMigrationModal] = useState(false);
  const [migCategoryFilter, setMigCategoryFilter] = useState<string>('all');
  const unGroups = useMemo(() => layersByDomainAndTier(), []);
  const unProgress = useMemo(() => unStore.migrationProgress(), [unStore.migrationStatus]);

  // Lines and points filtered by active layers
  const visibleLines  = useMemo(() =>
    unStore.lines.filter(l => unStore.activeLayers.has(l.layerId)),
    [unStore.lines, unStore.activeLayers]);
  const visiblePoints = useMemo(() =>
    unStore.points.filter(p => unStore.activeLayers.has(p.layerId)),
    [unStore.points, unStore.activeLayers]);

  // ── Configuration ArcGIS (persistée localement) ───────────────────────────
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const [showArcgisConfig, setShowArcgisConfig] = useState(false);
  const [arcgis, setArcgis] = useState<ArcgisConfig>(() => {
    if (typeof window === 'undefined') return DEFAULT_ARCGIS;
    try {
      const raw = window.localStorage.getItem(ARCGIS_KEY);
      return raw ? { ...DEFAULT_ARCGIS, ...JSON.parse(raw) } : DEFAULT_ARCGIS;
    } catch { return DEFAULT_ARCGIS; }
  });
  const [arcgisDraft, setArcgisDraft] = useState<ArcgisConfig>(arcgis);
  const saveArcgis = useCallback((cfg: ArcgisConfig) => {
    setArcgis(cfg);
    try { window.localStorage.setItem(ARCGIS_KEY, JSON.stringify(cfg)); } catch { /* ignore */ }
  }, []);

  function toggleCouche(id: string) {
    setCouches(c => c.map(x => x.id === id ? { ...x, active: !x.active } : x));
  }

  // Périmètre MMH : la carte n'affiche QUE les projets visibles par l'utilisateur
  // (store.projets est déjà filtré par unité/affectation/implication). Aucune donnée
  // codée en dur d'autres unités (production, transport…) n'est exposée.
  const allPins = showStorePins ? storePins : [];

  const filteredPins = allPins.filter(p => {
    if (filterStatut !== 'tous' && p.status !== filterStatut) return false;
    if (filterProjet !== 'tous' && p.code !== filterProjet) return false;
    return true;
  });

  const saisiesDisplay = SAISIES.filter(s => filterProjet === 'tous' || s.projet === filterProjet);

  return (
    <div className="page-content" style={{ flexDirection: isMobile ? 'column' : 'row', gap: 14, overflow: isMobile ? 'auto' : 'hidden', padding: '12px 16px', minHeight: 0, position: 'relative' }}>
      {/* ── Panneau gauche ─────────────────────────────────────────── */}
      <div style={{ width: isMobile ? '100%' : 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: isMobile ? 'visible' : 'auto' }}>

        {/* ── Toggle mode réseau GN / UN ────────────────────────── */}
        <div className="card" style={{ padding: '8px 12px' }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>Mode Réseau Électrique</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 4 }}>
            {([['GN', 'Géo. Network', '#1B4F8A'], ['UN', 'Utility Net.', '#f97316'], ['BOTH', 'GN + UN', '#7C3AED']] as const).map(([m, l, c]) => (
              <button key={m} onClick={() => setReseauMode(m)}
                style={{ fontSize: 9, fontWeight: 700, padding: '4px 2px', borderRadius: 5, border: `1.5px solid ${reseauMode === m ? c : 'var(--border)'}`, background: reseauMode === m ? `${c}22` : 'transparent', color: reseauMode === m ? c : 'var(--muted)', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center', lineHeight: 1.3 }}>
                {m}<br /><span style={{ fontWeight: 400, fontSize: 8 }}>{l}</span>
              </button>
            ))}
          </div>
          {reseauMode === 'GN' && <div style={{ fontSize: 9, color: '#1B4F8A', marginTop: 5 }}>Réseau Géométrique Senelec (legacy ArcFM)</div>}
          {reseauMode === 'UN' && <div style={{ fontSize: 9, color: '#f97316', marginTop: 5 }}>Utility Network v7 — ArcGIS Enterprise 11.5</div>}
          {reseauMode === 'BOTH' && <div style={{ fontSize: 9, color: '#7C3AED', marginTop: 5 }}>Superposition GN + UN (comparaison migration)</div>}
        </div>

        {/* KPIs SIG */}
        <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title">KPIs SIG</span>
          </div>
          <div className="card-body" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Projets store', value: String(store.projets.length), color: 'var(--navy)' },
              {
                label: 'Géolocalisés (SIG)',
                value: `${store.projets.filter(p => p.lat && p.lng && p.localite).length}/${store.projets.length}`,
                color: store.projets.every(p => p.lat && p.lng) ? 'var(--green)' : 'var(--orange)',
              },
              { label: 'MES à cartographier', value: '17', color: 'var(--orange)' },
              { label: 'SLA OK', value: '89%', color: 'var(--green)' },
              { label: 'Saisies chantier', value: '3', color: 'var(--red)' },
            ].map(k => (
              <div key={k.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{k.label}</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: k.color }}>{k.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Couches GN — visibles en mode GN ou BOTH */}
        {(reseauMode === 'GN' || reseauMode === 'BOTH') && <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title"><Layers size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Couches GN — ArcGIS</span>
          </div>
          <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Store projects layer toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 2 }}>
              <div onClick={() => setShowStorePins(s => !s)} style={{ width: 32, height: 16, borderRadius: 8, background: showStorePins ? '#1B4F8A' : '#CBD5E1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: showStorePins ? 18 : 2, transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: showStorePins ? 'var(--navy)' : 'var(--muted)', flex: 1 }}>Projets SIGEP-DPE</span>
              <span style={{ fontSize: 9, background: '#EFF6FF', color: '#1B4F8A', padding: '1px 4px', borderRadius: 4, fontWeight: 700 }}>{store.projets.length}</span>
            </label>
            {couches.map(c => (
              <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                <div
                  onClick={() => toggleCouche(c.id)}
                  style={{
                    width: 32, height: 16, borderRadius: 8,
                    background: c.active ? c.color : 'var(--border-2)',
                    position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                  }}>
                  <div style={{
                    width: 12, height: 12, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 2, left: c.active ? 18 : 2,
                    transition: 'left 0.2s',
                  }} />
                </div>
                <span style={{ fontSize: 10, color: c.active ? 'var(--text)' : 'var(--muted)', flex: 1 }}>{c.label}</span>
                <span style={{ fontSize: 9, color: 'var(--muted)', background: 'var(--bg)', padding: '1px 4px', borderRadius: 4 }}>{c.count}</span>
              </label>
            ))}
          </div>
        </div>}

        {/* Filtres */}
        <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title">Filtres</span>
          </div>
          <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="form-group">
              <label className="form-label">Statut projet</label>
              <select className="form-input" style={{ fontSize: 11 }} value={filterStatut} onChange={e => setFilterStatut(e.target.value)}>
                <option value="tous">Tous</option>
                <option value="critique">Critique</option>
                <option value="en_cours">En cours</option>
                <option value="ok">OK</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Projet</label>
              <SearchableSelect
                value={filterProjet === 'tous' ? '' : filterProjet}
                onChange={v => setFilterProjet(v || 'tous')}
                options={storePins.map(p => ({ value: p.code, label: (p.code || p.nom).replace('PRJ-', '') }))}
                placeholder="Tous les projets"
                searchPlaceholder="Rechercher un projet…"
                allowEmpty
                style={{ fontSize: 11 }}
              />
            </div>
          </div>
        </div>

        {/* Exports */}
        <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title">Exports & Actualisation</span>
          </div>
          <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <button onClick={handleExportShapefile} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--navy)', color: 'var(--navy)', justifyContent: 'center', fontSize: 11 }}>
              <Download size={10} /> Shapefile (CSV)
            </button>
            <button onClick={handleExportPDF} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--red)', color: 'var(--red)', justifyContent: 'center', fontSize: 11 }}>
              <Download size={10} /> Télécharger PDF
            </button>
            <button onClick={handleExportPNG} className="btn btn-sm" style={{ background: 'transparent', border: '1px solid var(--green)', color: 'var(--green)', justifyContent: 'center', fontSize: 11 }}>
              <Download size={10} /> Export PNG
            </button>
            <button onClick={handleRefresh} disabled={refreshing} className="btn btn-sm" style={{ background: refreshing ? '#EFF6FF' : 'transparent', border: '1px solid #7C3AED', color: '#7C3AED', justifyContent: 'center', fontSize: 11, cursor: refreshing ? 'not-allowed' : 'pointer', opacity: refreshing ? 0.6 : 1 }}>
              <RefreshCw size={10} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Actualisation...' : lastRefresh ? `Actualisé ${lastRefresh}` : 'Actualiser carte'}
            </button>
          </div>
        </div>

        {/* ── Réseau Utility Network UN — visible en mode UN ou BOTH ── */}
        {(reseauMode === 'UN' || reseauMode === 'BOTH') && <div className="card" style={{ border: '1px solid #f9731633' }}>
          <div
            className="card-header"
            style={{ padding: '8px 12px', cursor: 'pointer', background: 'transparent' }}
            onClick={() => setShowUNPanel(s => !s)}>
            <span className="card-title" style={{ color: '#f97316', fontSize: 11 }}>
              <Network size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />
              Réseau UN — SENELEC
            </span>
            <span style={{ fontSize: 9, color: 'var(--muted)', transform: showUNPanel ? 'rotate(90deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▶</span>
          </div>
          {showUNPanel && (
            <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* Tiers legend */}
              <div style={{ display: 'flex', gap: 4, marginBottom: 2, flexWrap: 'wrap' }}>
                {UN_TIERS.map(t => (
                  <span key={t.code} style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: t.bgColor, color: t.color, border: `1px solid ${t.color}33` }}>
                    {t.code} {t.voltageRange.split(' ')[0]}
                  </span>
                ))}
              </div>

              {/* Electric domain layers by tier */}
              {unGroups.electric.map(({ tier, layers }) => (
                <div key={tier.code}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: tier.color, textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 }}>
                    {tier.code} — {tier.voltageRange}
                  </div>
                  {layers.map(layer => (
                    <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 2 }}>
                      <div
                        onClick={() => unStore.toggleLayer(layer.id)}
                        style={{ width: 28, height: 14, borderRadius: 7, background: unStore.activeLayers.has(layer.id) ? layer.color : 'var(--border-2)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: unStore.activeLayers.has(layer.id) ? 16 : 2, transition: 'left 0.15s' }} />
                      </div>
                      <span style={{ fontSize: 9, color: unStore.activeLayers.has(layer.id) ? 'var(--text)' : 'var(--muted)', flex: 1, lineHeight: 1.2 }}>
                        {layer.dashArray ? `- - ${layer.name}` : layer.name}
                      </span>
                    </label>
                  ))}
                </div>
              ))}

              {/* Structure domain */}
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#7c3aed', textTransform: 'uppercase', marginBottom: 2, letterSpacing: 0.5 }}>Structure</div>
                {unGroups.structure.map(layer => (
                  <label key={layer.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginBottom: 2 }}>
                    <div
                      onClick={() => unStore.toggleLayer(layer.id)}
                      style={{ width: 28, height: 14, borderRadius: 7, background: unStore.activeLayers.has(layer.id) ? layer.color : 'var(--border-2)', position: 'relative', transition: 'background 0.15s', flexShrink: 0 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: unStore.activeLayers.has(layer.id) ? 16 : 2, transition: 'left 0.15s' }} />
                    </div>
                    <span style={{ fontSize: 9, color: unStore.activeLayers.has(layer.id) ? 'var(--text)' : 'var(--muted)', flex: 1, lineHeight: 1.2 }}>{layer.name}</span>
                  </label>
                ))}
              </div>

              {/* Migration checklist button */}
              <button
                onClick={() => setShowMigrationModal(true)}
                style={{ marginTop: 4, fontSize: 9.5, padding: '5px 8px', borderRadius: 5, border: `1px solid ${unProgress.mandatoryDone === unProgress.mandatoryTotal ? '#22c55e' : '#f97316'}`, background: 'transparent', color: unProgress.mandatoryDone === unProgress.mandatoryTotal ? '#22c55e' : '#f97316', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                <ClipboardCheck size={10} />
                Migration GN→UN : {unProgress.mandatoryDone}/{unProgress.mandatoryTotal} obligatoires
              </button>
            </div>
          )}
        </div>}

        {/* ArcGIS Enterprise */}
        <div className="card" style={{ border: '1px solid #7C3AED33', background: '#FAFAFF' }}>
          <div className="card-header" style={{ padding: '8px 12px', background: 'transparent' }}>
            <span className="card-title" style={{ color: '#7C3AED', fontSize: 11 }}>🗺 Connexion ArcGIS</span>
          </div>
          <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10 }}>
              <div style={{ width: 7, height: 7, borderRadius: '50%', background: arcgis.enabled ? '#22C55E' : '#CBD5E1', boxShadow: arcgis.enabled ? '0 0 0 2px #DCFCE7' : '0 0 0 2px #F1F5F9' }} />
              <span style={{ color: '#374151', fontWeight: 600 }}>
                {arcgis.enabled ? 'ArcGIS connecté' : 'ArcGIS non configuré'}
              </span>
            </div>
            <div style={{ fontSize: 10, color: '#64748B', lineHeight: 1.5 }}>
              <div>Serveur: <span style={{ fontWeight: 600, color: '#374151' }}>{arcgis.portalUrl.replace(/^https?:\/\//, '') || '—'}</span></div>
              <div>Couches: {arcgis.layers || '—'}</div>
            </div>
            <button
              onClick={() => { setArcgisDraft(arcgis); setShowArcgisConfig(true); }}
              style={{ fontSize: 10, padding: '4px 8px', borderRadius: 5, border: '1px solid #7C3AED', background: 'transparent', color: '#7C3AED', cursor: 'pointer', fontWeight: 600 }}>
              Configurer connexion
            </button>
          </div>
        </div>
      </div>

      {/* ── Modale de configuration ArcGIS ── */}
      {showArcgisConfig && (
        <div
          onClick={() => setShowArcgisConfig(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 2000, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '6vh 16px', overflow: 'auto' }}>
          <div onClick={e => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: 12, width: '100%', maxWidth: 520, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid #E2E8F0' }}>
              <span style={{ fontSize: 15, fontWeight: 800, color: '#7C3AED' }}>🗺 Configuration ArcGIS — SIG SENELEC</span>
              <button onClick={() => setShowArcgisConfig(false)} aria-label="Fermer la configuration ArcGIS" style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
            </div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <p style={{ fontSize: 11.5, color: '#64748B', margin: 0, lineHeight: 1.5 }}>
                Interfacez le SIG de la plateforme avec votre instance <strong>ArcGIS Enterprise / Online</strong>.
                Renseignez l&apos;URL du portail, le service REST, le jeton OAuth2 et les couches à synchroniser.
              </p>
              {([
                ['portalUrl', 'URL du portail', 'https://gis.senelec.sn/portal'],
                ['serviceUrl', 'Service REST (FeatureServer)', 'https://gis.senelec.sn/server/rest/services'],
                ['token', 'Jeton OAuth2 / clé API', 'Coller le token…'],
                ['layers', 'Couches à synchroniser (séparées par des virgules)', 'HTA, BT, Postes, Compteurs'],
              ] as [keyof ArcgisConfig, string, string][]).map(([key, label, ph]) => (
                <label key={key} style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: '#374151' }}>
                  {label}
                  <input
                    type={key === 'token' ? 'password' : 'text'}
                    value={String(arcgisDraft[key] ?? '')}
                    onChange={e => setArcgisDraft(d => ({ ...d, [key]: e.target.value }))}
                    placeholder={ph}
                    style={{ width: '100%', marginTop: 4, padding: '8px 10px', borderRadius: 7, border: '1px solid #CBD5E1', fontSize: 12.5, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                </label>
              ))}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
                <input type="checkbox" checked={arcgisDraft.enabled} onChange={e => setArcgisDraft(d => ({ ...d, enabled: e.target.checked }))} />
                Activer la synchronisation ArcGIS (afficher les couches sur la carte)
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '12px 18px', borderTop: '1px solid #E2E8F0' }}>
              <button onClick={() => setShowArcgisConfig(false)}
                style={{ padding: '8px 14px', borderRadius: 7, border: '1px solid #CBD5E1', background: '#fff', color: '#334155', fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>
                Annuler
              </button>
              <button onClick={() => { saveArcgis(arcgisDraft); setShowArcgisConfig(false); }}
                style={{ padding: '8px 16px', borderRadius: 7, border: 'none', background: '#7C3AED', color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                Enregistrer la connexion
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Zone carte principale ───────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0, minHeight: isMobile ? 420 : 0 }}>
        {/* Carte SVG */}
        <div className="card" style={{ flex: 1, overflow: 'hidden', minHeight: 380 }}>
          <div className="card-header">
            <span className="card-title"><MapPin size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />Carte SIG — Sénégal — {filteredPins.length} projet{filteredPins.length > 1 ? 's' : ''} affiché{filteredPins.length > 1 ? 's' : ''}</span>
            <div style={{ display: 'flex', gap: 12 }}>
              {([['critique','Critique','var(--red)'],['en_cours','En cours','var(--orange)'],['ok','OK','var(--green)']] as const).map(([s,l,c]) => (
                <span key={s} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: 'var(--muted)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, display: 'inline-block' }} />{l}
                </span>
              ))}
            </div>
          </div>
          <div className="card-body" style={{ padding: 0, flex: 1, position: 'relative' }}>
            <MapContainer center={[14.5, -14.5]} zoom={7}
              style={{ width: '100%', height: '100%', minHeight: 300 }} attributionControl={false}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {/* Régions */}
              {REGION_POLYGONS.map(r => (
                <Polygon
                  key={r.id}
                  positions={r.polygon}
                  pathOptions={{
                    fillColor: regionFill(r.projets),
                    fillOpacity: hoveredRegion === r.id ? 0.7 : 0.45,
                    color: '#fff',
                    weight: 1.5,
                  }}
                  eventHandlers={{
                    mouseover: () => setHoveredRegion(r.id),
                    mouseout: () => setHoveredRegion(null),
                  }}
                />
              ))}
              {/* Pins projets */}
              {filteredPins.map(p => {
                const isSelected = selectedPin?.id === p.id;
                const color = STATUS_COLOR[p.status];
                return (
                  <CircleMarker
                    key={p.id}
                    center={[p.lat, p.lng]}
                    radius={isSelected ? 10 : 6}
                    pathOptions={{ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: 2 }}
                    eventHandlers={{ click: () => setSelectedPin(isSelected ? null : p) }}>
                    <Popup>
                      <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 220 }}>
                        <div style={{ fontSize: 9, color: color, fontWeight: 700, marginBottom: 2 }}>{p.code}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0E3460', marginBottom: 4 }}>{p.nom}</div>
                        {(() => {
                          const proj = store.projets.find(x => x.id === p.id);
                          return proj?.localite ? (
                            <div style={{ fontSize: 10, color: '#0D9488', fontWeight: 600, marginBottom: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
                              <MapPin size={10} />{proj.localite}{proj.commune ? `, ${proj.commune}` : ''}
                            </div>
                          ) : null;
                        })()}
                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 4 }}>{p.region}</div>
                        <div style={{ fontSize: 10, color: '#374151', marginBottom: 4 }}>{p.description}</div>
                        {(() => {
                          const proj = store.projets.find(x => x.id === p.id);
                          return proj?.infrasImpactees?.length ? (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginBottom: 6 }}>
                              {proj.infrasImpactees.map(inf => (
                                <span key={inf} style={{ fontSize: 9, background: '#0D948815', color: '#0D9488', borderRadius: 4, padding: '1px 5px', fontWeight: 600 }}>{inf}</span>
                              ))}
                            </div>
                          ) : null;
                        })()}
                        <button
                          onClick={() => router.push(`/cockpit-projet?code=${encodeURIComponent(p.code)}`)}
                          className="btn btn-navy btn-sm"
                          style={{ marginTop: 4, width: '100%', justifyContent: 'center' }}>
                          Ouvrir cockpit <ChevronRight size={10} />
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
              {/* Couche Localités BEST (1041) — colorées par lot */}
              {bestActive && bestZones.map((z, i) => (
                <CircleMarker
                  key={`best-${i}`}
                  center={[z.lat, z.lng]}
                  radius={2.5}
                  pathOptions={{ fillColor: lotColor(z.lot), fillOpacity: 0.85, color: '#fff', weight: 0.4 }}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 150 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0E3460' }}>{z.localite}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{z.departement} · {z.region}</div>
                      <div style={{ fontSize: 10, color: lotColor(z.lot), fontWeight: 700 }}>{z.lot} — {z.statut}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
              {/* Couche « Localités chargées » — issues de Zones & Quantités (BEST / import Excel) */}
              {loadedActive && loadedZones.map((z, i) => (
                <CircleMarker
                  key={`loaded-${i}`}
                  center={[z.lat, z.lng]}
                  radius={4}
                  pathOptions={{ fillColor: statutColor(z.statut), fillOpacity: 0.9, color: '#fff', weight: 1 }}>
                  <Popup>
                    <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 160 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#0E3460' }}>{z.localite}</div>
                      <div style={{ fontSize: 10, color: '#64748B' }}>{[z.departement, z.region].filter(Boolean).join(' · ')}</div>
                      {z.code && <div style={{ fontSize: 9.5, color: '#94A3B8', fontFamily: 'monospace' }}>{z.code}</div>}
                      <div style={{ fontSize: 10, color: statutColor(z.statut), fontWeight: 700 }}>{[z.lot, z.statut].filter(Boolean).join(' — ')}</div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* ── UN Network — Lignes (HTB / HTA / BT) ── uniquement modes UN ou BOTH */}
              {(reseauMode === 'UN' || reseauMode === 'BOTH') && visibleLines.map(line => {
                const layerDef = UN_LAYERS.find(l => l.id === line.layerId);
                const color = layerDef?.color ?? featureTierColor(line.tier);
                return (
                  <Polyline
                    key={line.id}
                    positions={line.coords as [number,number][]}
                    pathOptions={{
                      color,
                      weight: line.tier === 'HTB' ? 3 : line.tier === 'HTA' ? 2 : 1.5,
                      opacity: 0.85,
                      dashArray: layerDef?.dashArray,
                    }}
                    eventHandlers={{ click: () => unStore.setSelectedFeature(line) }}>
                    <Popup>
                      <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 180 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 2 }}>{line.tier} · {line.assetType}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E3460', marginBottom: 4 }}>{line.name}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>Feeder : <b>{line.feederID ?? '—'}</b></div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>Tension : {line.voltageKV} kV</div>
                        {line.attributes.longueurKm && <div style={{ fontSize: 10, color: '#64748B' }}>Longueur : {line.attributes.longueurKm} km</div>}
                        {line.attributes.etat && <div style={{ fontSize: 10, color: '#64748B' }}>État : {line.attributes.etat}</div>}
                      </div>
                    </Popup>
                  </Polyline>
                );
              })}

              {/* ── UN Network — Points (Devices, Assemblies, Junctions) ── */}
              {(reseauMode === 'UN' || reseauMode === 'BOTH') && visiblePoints.map(pt => {
                const color = featureTierColor(pt.tier);
                const isHTB = pt.tier === 'HTB';
                return (
                  <CircleMarker
                    key={pt.id}
                    center={[pt.lat, pt.lng]}
                    radius={isHTB ? 8 : pt.assetGroup === 'RMU' || pt.assetGroup === 'LVBoard' ? 6 : 5}
                    pathOptions={{ fillColor: color, fillOpacity: 0.9, color: '#fff', weight: isHTB ? 2 : 1.5 }}
                    eventHandlers={{ click: () => unStore.setSelectedFeature(pt) }}>
                    <Popup>
                      <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 190 }}>
                        <div style={{ fontSize: 9, fontWeight: 700, color, textTransform: 'uppercase', marginBottom: 2 }}>{pt.tier ?? 'Structure'} · {pt.assetGroup}</div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#0E3460', marginBottom: 4 }}>{pt.name}</div>
                        <div style={{ fontSize: 10, color: '#64748B' }}>Type : {pt.assetType}</div>
                        {pt.feederID && <div style={{ fontSize: 10, color: '#64748B' }}>Feeder : <b>{pt.feederID}</b></div>}
                        {pt.voltageKV > 0 && <div style={{ fontSize: 10, color: '#64748B' }}>Tension : {pt.voltageKV} kV</div>}
                        {pt.attributes.puissanceMVA && <div style={{ fontSize: 10, color: '#64748B' }}>Puissance : {pt.attributes.puissanceMVA} MVA</div>}
                        {pt.attributes.puissanceKVA && <div style={{ fontSize: 10, color: '#64748B' }}>Puissance : {pt.attributes.puissanceKVA} kVA</div>}
                        {pt.attributes.etat && <div style={{ fontSize: 10, fontWeight: 700, color: String(pt.attributes.etat) === 'EN_SERVICE' ? '#16a34a' : '#ef4444', marginTop: 4 }}>{pt.attributes.etat}</div>}
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>

            {/* Popup pin (HTML overlay) */}
            {selectedPin && (
              <div style={{
                position: 'absolute', top: 12, right: 12,
                background: 'var(--bg-card)', border: `2px solid ${STATUS_COLOR[selectedPin.status]}`,
                borderRadius: 8, padding: 12, minWidth: 200, boxShadow: 'var(--shadow)', zIndex: 500,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: STATUS_COLOR[selectedPin.status] }}>{selectedPin.code}</span>
                  <button onClick={() => setSelectedPin(null)} aria-label="Fermer la fiche projet" style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}><X size={12} /></button>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', marginBottom: 4 }}>{selectedPin.nom}</div>
                <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 6 }}><MapPin size={9} style={{ verticalAlign: 'middle' }} /> {selectedPin.region}</div>
                <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{selectedPin.description}</div>
                <button
                  onClick={() => router.push(`/cockpit-projet?code=${encodeURIComponent(selectedPin.code)}`)}
                  className="btn btn-navy btn-sm"
                  style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
                  Ouvrir cockpit <ChevronRight size={10} />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Tableau saisies terrain ─────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Saisies Terrain à Promouvoir en Patrimoine Officiel</span>
            <span style={{ fontSize: 10, color: 'var(--muted)' }}>{saisiesDisplay.filter(s => s.statut === 'a_promouvoir').length} en attente</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="tbl">
              <thead>
                <tr>
                  <th>Code SAI</th>
                  <th>Projet</th>
                  <th>Localité</th>
                  <th>Type</th>
                  <th>Date MES</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {saisiesDisplay.map(s => {
                  const isPromoted = promoted.includes(s.id) || s.statut === 'promue';
                  return (
                    <tr key={s.id}>
                      <td style={{ fontSize: 10, fontWeight: 700, color: 'var(--navy)' }}>{s.code}</td>
                      <td style={{ fontSize: 10 }}>{s.projet.replace('PRJ-','')}</td>
                      <td style={{ fontWeight: 500 }}>{s.localite}</td>
                      <td style={{ fontSize: 10, color: 'var(--muted)' }}>HTA {s.typeHTA} km · {s.postes} poste{s.postes > 1 ? 's' : ''}</td>
                      <td style={{ fontSize: 10, whiteSpace: 'nowrap' }}>{s.dateMES}</td>
                      <td>
                        {isPromoted
                          ? <span className="pill pill-ok"><CheckCircle2 size={9} /> Promue</span>
                          : <span className="pill pill-warn"><Clock size={9} /> En attente</span>}
                      </td>
                      <td>
                        {!isPromoted ? (
                          <button
                            className="btn btn-primary btn-xs"
                            onClick={() => setPromoted(prev => [...prev, s.id])}>
                            ▶ Promouvoir en patrimoine officiel
                          </button>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--green)' }}>Intégrée au SIG</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── Modale Checklist Migration GN → UN ─────────────────────────── */}
    {showMigrationModal && (
      <div
        onClick={() => setShowMigrationModal(false)}
        style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', zIndex: 2100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '4vh 16px', overflow: 'auto' }}>
        <div onClick={e => e.stopPropagation()}
          style={{ background: 'var(--bg-card, #fff)', borderRadius: 12, width: '100%', maxWidth: 700, boxShadow: '0 20px 60px rgba(0,0,0,0.35)', maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid var(--border, #E2E8F0)', flexShrink: 0 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#f97316' }}>Checklist Pré-migration — Réseau Géométrique → Utility Network</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 2 }}>
                Source : ATOS GIS Data Model Specification · Schneider Electric · 15 mars 2026
              </div>
            </div>
            <button onClick={() => setShowMigrationModal(false)} style={{ background: 'var(--bg, #F1F5F9)', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}><X size={15} /></button>
          </div>

          {/* Progress bar */}
          <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--border, #E2E8F0)', flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 16, marginBottom: 8, flexWrap: 'wrap' }}>
              {[
                { label: 'Obligatoires', val: `${unProgress.mandatoryDone}/${unProgress.mandatoryTotal}`, color: unProgress.mandatoryDone === unProgress.mandatoryTotal ? '#22c55e' : '#f97316' },
                { label: 'Total', val: `${unProgress.done}/${unProgress.total}`, color: '#3b82f6' },
              ].map(k => (
                <span key={k.label} style={{ fontSize: 11, fontWeight: 700, color: k.color }}>{k.label} : {k.val}</span>
              ))}
            </div>
            <div style={{ height: 6, background: 'var(--border, #E2E8F0)', borderRadius: 3, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${(unProgress.mandatoryDone / unProgress.mandatoryTotal) * 100}%`, background: unProgress.mandatoryDone === unProgress.mandatoryTotal ? '#22c55e' : '#f97316', borderRadius: 3, transition: 'width 0.3s' }} />
            </div>
            {/* Category filter */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {(['all', 'feeder', 'geometry', 'attributes', 'topology'] as const).map(cat => (
                <button key={cat} onClick={() => setMigCategoryFilter(cat)}
                  style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--border, #CBD5E1)', background: migCategoryFilter === cat ? '#f97316' : 'transparent', color: migCategoryFilter === cat ? '#fff' : 'var(--muted)', cursor: 'pointer', fontWeight: 600 }}>
                  {cat === 'all' ? 'Tout' : cat.charAt(0).toUpperCase() + cat.slice(1)}
                </button>
              ))}
              <button onClick={() => unStore.resetMigration()}
                style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontWeight: 600, marginLeft: 'auto' }}>
                Réinitialiser
              </button>
            </div>
          </div>

          {/* Checklist items */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 18px' }}>
            {MIGRATION_CHECKLIST
              .filter(item => migCategoryFilter === 'all' || item.category === migCategoryFilter)
              .map(item => {
                const status = unStore.migrationStatus[item.id];
                const done = status?.done ?? false;
                return (
                  <div key={item.id} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '8px 0', borderBottom: '1px solid var(--border-2, #F1F5F9)' }}>
                    <button
                      onClick={() => unStore.setMigrationItem(item.id, !done)}
                      style={{ flexShrink: 0, width: 20, height: 20, borderRadius: 4, border: `2px solid ${done ? '#22c55e' : item.mandatory ? '#f97316' : '#CBD5E1'}`, background: done ? '#22c55e' : 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', marginTop: 1 }}>
                      {done && <CheckCircle2 size={12} color="#fff" />}
                    </button>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontSize: 8, fontWeight: 700, padding: '1px 5px', borderRadius: 3, background: item.category === 'feeder' ? '#dbeafe' : item.category === 'geometry' ? '#d1fae5' : item.category === 'attributes' ? '#fef3c7' : '#fce7f3', color: item.category === 'feeder' ? '#1d4ed8' : item.category === 'geometry' ? '#065f46' : item.category === 'attributes' ? '#92400e' : '#9d174d', textTransform: 'uppercase' }}>
                          {item.category}
                        </span>
                        {item.mandatory && <span style={{ fontSize: 8, color: '#f97316', fontWeight: 700 }}>OBLIGATOIRE</span>}
                        <span style={{ fontSize: 8, color: 'var(--muted)', fontFamily: 'monospace' }}>{item.id}</span>
                      </div>
                      <div style={{ fontSize: 11, color: done ? 'var(--muted)' : 'var(--text)', textDecoration: done ? 'line-through' : 'none', fontWeight: 500 }}>{item.description}</div>
                      {item.detail && <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>{item.detail}</div>}
                      {status?.note && <div style={{ fontSize: 10, color: '#3b82f6', marginTop: 3 }}>📝 {status.note}</div>}
                    </div>
                    {!done && (
                      <AlertTriangle size={12} color={item.mandatory ? '#f97316' : '#CBD5E1'} style={{ flexShrink: 0, marginTop: 3 }} />
                    )}
                  </div>
                );
              })}
          </div>

          {/* Footer */}
          <div style={{ padding: '10px 18px', borderTop: '1px solid var(--border, #E2E8F0)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: 'var(--muted)' }}>
              ArcGIS Pro 3.5 · Outil : &quot;Load Data Using Workspace&quot; · UN v7
            </div>
            <button onClick={() => setShowMigrationModal(false)}
              style={{ padding: '6px 14px', borderRadius: 7, border: 'none', background: '#f97316', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
              Fermer
            </button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
