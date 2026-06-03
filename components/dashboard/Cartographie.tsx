'use client';

import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Layers, MapPin, Download, CheckCircle2, Clock, ChevronRight, X, RefreshCw, ZoomIn, ZoomOut, Maximize } from 'lucide-react';
import { useProjectStore, DOMAINE_CFG } from '@/lib/projectStore';
import { SENELEC_LOGO_DATA_URI } from '@/lib/senelecLogo';
import { MapContainer, TileLayer, Polygon, CircleMarker, Popup, useMapEvent } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { LatLngExpression } from 'leaflet';

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
const ARCGIS_KEY = 'sigepp-arcgis-config';
const DEFAULT_ARCGIS: ArcgisConfig = {
  enabled: false,
  portalUrl: 'https://gis.senelec.sn/portal',
  serviceUrl: 'https://gis.senelec.sn/server/rest/services',
  token: '',
  layers: 'HTA, BT, Postes, Compteurs',
};

const PIN_PROJETS: PinProjet[] = [
  { id: 'p1', code: 'PRJ-DER-2024-001', nom: 'Électrification Casamance', region: 'Ziguinchor', lat: 12.55, lng: -16.25, status: 'en_cours', description: '24 localités · AFD · 65%' },
  { id: 'p2', code: 'PRJ-DER-2023-005', nom: 'HTA Kaolack', region: 'Kaolack', lat: 14.15, lng: -16.05, status: 'ok', description: 'Poste 90/30kV · BM · 78%' },
  { id: 'p3', code: 'PRJ-DER-2026-008', nom: 'Électrification Mbour', region: 'Thiès', lat: 14.50, lng: -17.05, status: 'critique', description: 'Zones périurbaines · SPI=0.68 · 12%' },
  { id: 'p4', code: 'PRJ-DIT-2024-003', nom: 'Smartgrid Dakar', region: 'Dakar', lat: 14.72, lng: -17.47, status: 'critique', description: 'Pilote Plateau · BEI · 55%' },
  { id: 'p5', code: 'PRJ-DGC-2025-001', nom: 'Centre Thiès', region: 'Thiès', lat: 14.80, lng: -16.93, status: 'en_cours', description: 'Génie civil · SENELEC · 30%' },
  { id: 'p6', code: 'PRJ-DEP-2024-007', nom: 'Solaire Hybride Touba', region: 'Diourbel', lat: 14.65, lng: -16.22, status: 'ok', description: 'Centrale hybride · BM · 80%' },
  { id: 'p7', code: 'PRJ-DER-2026-014', nom: 'Sédhiou Électrification', region: 'Sédhiou', lat: 12.71, lng: -15.56, status: 'critique', description: '18 localités · SPI=0.72 · 22%' },
  { id: 'p8', code: 'PRJ-DER-2025-022', nom: 'Kédougou BT', region: 'Kédougou', lat: 12.55, lng: -12.18, status: 'critique', description: 'Extension BT · BAD · CPI=0.81' },
  { id: 'p9', code: 'PRJ-CC26-2024-001', nom: 'MCA Ligne 225kV', region: 'Thiès', lat: 14.85, lng: -16.85, status: 'en_cours', description: 'Transport · MCA · 45%' },
  { id: 'p10', code: 'PRJ-DEP-2025-003', nom: 'Parc Éolien Taiba', region: 'Thiès', lat: 14.90, lng: -16.70, status: 'ok', description: 'Extension · BEI · 92%' },
  { id: 'p11', code: 'PRJ-DGC-2024-002', nom: 'Réhabilitation St-Louis', region: 'Saint-Louis', lat: 16.02, lng: -16.49, status: 'ok', description: 'Bâtiments · SENELEC · 58%' },
];

const SAISIES: SaisiesTerrain[] = [
  { id: 's1', code: 'SAI-2026-047', projet: 'PRJ-DER-2024-001', localite: 'Niaguis', typeHTA: 2.4, postes: 2, dateMES: '15/05/2026', statut: 'a_promouvoir' },
  { id: 's2', code: 'SAI-2026-048', projet: 'PRJ-DER-2024-001', localite: 'Boutoupa', typeHTA: 1.8, postes: 1, dateMES: '18/05/2026', statut: 'a_promouvoir' },
  { id: 's3', code: 'SAI-2026-051', projet: 'PRJ-DEP-2024-007', localite: 'Diourbel-N', typeHTA: 0.6, postes: 1, dateMES: '20/05/2026', statut: 'a_promouvoir' },
  { id: 's4', code: 'SAI-2026-053', projet: 'PRJ-DER-2023-005', localite: 'Kaolack-Sud', typeHTA: 3.2, postes: 3, dateMES: '22/05/2026', statut: 'a_promouvoir' },
  { id: 's5', code: 'SAI-2026-041', projet: 'PRJ-DEP-2025-003', localite: 'Taiba-Est', typeHTA: 4.0, postes: 4, dateMES: '10/05/2026', statut: 'promue' },
  { id: 's6', code: 'SAI-2026-039', projet: 'PRJ-DER-2023-005', localite: 'Kaolack-Nord', typeHTA: 2.0, postes: 2, dateMES: '05/05/2026', statut: 'promue' },
];

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
  const router = useRouter();
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
      <meta charset="UTF-8"><title>Carte SIG — SIGEPP-DPE — ${new Date().toLocaleDateString('fr-FR')}</title>
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
      <div style="font-size:10px;font-weight:700;letter-spacing:0.1em;color:#888;text-transform:uppercase;margin-bottom:16px">SENELEC · SIGEPP-DPE · Direction Principale Équipement</div>
      <h1>Rapport SIG — Carte Portefeuille Projets</h1>
      <div style="font-size:12px;color:#64748B;margin-bottom:20px">Généré le ${new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })} à ${new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</div>
      <div>
        <div class="kpi"><div class="kpi-val">${store.projets.length + PIN_PROJETS.length}</div><div class="kpi-lbl">Projets cartographiés</div></div>
        <div class="kpi"><div class="kpi-val">14</div><div class="kpi-lbl">Régions couvertes</div></div>
        <div class="kpi"><div class="kpi-val">6</div><div class="kpi-lbl">Saisies terrain</div></div>
        <div class="kpi"><div class="kpi-val">89%</div><div class="kpi-lbl">SLA cartographie OK</div></div>
      </div>
      <h2>Projets géoréférencés</h2>
      <table>
        <thead><tr><th>Code</th><th>Projet</th><th>Région</th><th>Statut</th><th>Description</th></tr></thead>
        <tbody>
          ${PIN_PROJETS.map(p => `<tr><td>${p.code}</td><td>${p.nom}</td><td>${p.region}</td><td>${p.status}</td><td>${p.description}</td></tr>`).join('')}
        </tbody>
      </table>
      <h2>Saisies terrain en attente de promotion</h2>
      <table>
        <thead><tr><th>Code SAI</th><th>Projet</th><th>Localité</th><th>Type HTA</th><th>Date MES</th><th>Statut</th></tr></thead>
        <tbody>
          ${SAISIES.map(s => `<tr><td>${s.code}</td><td>${s.projet}</td><td>${s.localite}</td><td>HTA ${s.typeHTA} km · ${s.postes} poste(s)</td><td>${s.dateMES}</td><td>${s.statut === 'promue' ? 'Promue' : 'En attente'}</td></tr>`).join('')}
        </tbody>
      </table>
      <div class="footer">CONFIDENTIEL — Usage interne SENELEC · SIGEPP-DPE uniquement · Rapport généré automatiquement</div>
    </body></html>`);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 500);
  }, [store.projets]);

  const handleExportShapefile = useCallback(() => {
    // Génère un CSV géocodé (remplace shapefile en environnement web)
    const headers = ['code,nom,region,statut,description,latitude,longitude'];
    const rows = PIN_PROJETS.map(p => {
      return `${p.code},"${p.nom}",${p.region},${p.status},"${p.description}",${p.lat},${p.lng}`;
    });
    const csv = [...headers, ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `SIGEPP-DPE_Cartographie_${new Date().toISOString().split('T')[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  }, []);

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
  ]);

  // Couche « Localités BEST » : 1041 localités réelles, chargées en lazy-import à l'activation.
  const bestActive = couches.find(c => c.id === 'best')?.active ?? false;
  const [bestZones, setBestZones] = useState<{ lat: number; lng: number; localite: string; lot: string; statut: string; region: string; departement: string }[]>([]);
  useEffect(() => {
    if (bestActive && bestZones.length === 0) {
      import('@/lib/zonesBEST').then(({ ZONES_BEST }) => {
        setBestZones(ZONES_BEST
          .filter(z => typeof z.lat === 'number' && typeof z.lng === 'number')
          .map(z => ({ lat: z.lat as number, lng: z.lng as number, localite: z.localite, lot: z.lot, statut: z.statut, region: z.region, departement: z.departement })));
      });
    }
  }, [bestActive, bestZones.length]);
  const lotColor = (lot: string) => lot === 'LOT 1' ? '#0EA5E9' : lot === 'LOT 2' ? '#8B5CF6' : '#10B981';

  const [filterStatut, setFilterStatut] = useState('tous');
  const [filterProjet, setFilterProjet] = useState('tous');
  const [selectedPin, setSelectedPin] = useState<PinProjet | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);
  const [promoted, setPromoted] = useState<string[]>([]);
  const [showStorePins, setShowStorePins] = useState(true);

  // ── Configuration ArcGIS (persistée localement) ───────────────────────────
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

  // Convert store projects to map pins (lat/lng)
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

  const allPins = [...PIN_PROJETS, ...(showStorePins ? storePins : [])];

  const filteredPins = allPins.filter(p => {
    if (filterStatut !== 'tous' && p.status !== filterStatut) return false;
    if (filterProjet !== 'tous' && p.code !== filterProjet) return false;
    return true;
  });

  const saisiesDisplay = SAISIES.filter(s => filterProjet === 'tous' || s.projet === filterProjet);

  return (
    <div className="page-content" style={{ flexDirection: 'row', gap: 14, overflow: 'hidden', padding: '12px 16px', minHeight: 0 }}>
      {/* ── Panneau gauche ─────────────────────────────────────────── */}
      <div style={{ width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
        {/* KPIs SIG */}
        <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title">KPIs SIG</span>
          </div>
          <div className="card-body" style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { label: 'Projets store', value: String(store.projets.length), color: 'var(--navy)' },
              { label: 'MES à cartographier', value: '17', color: 'var(--orange)' },
              { label: 'Délai moyen màj', value: '4.2j', color: 'var(--navy)' },
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

        {/* Couches */}
        <div className="card">
          <div className="card-header" style={{ padding: '8px 12px' }}>
            <span className="card-title"><Layers size={11} style={{ verticalAlign: 'middle', marginRight: 4 }} />Couches ArcGIS</span>
          </div>
          <div className="card-body" style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {/* Store projects layer toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', borderBottom: '1px solid #F1F5F9', paddingBottom: 6, marginBottom: 2 }}>
              <div onClick={() => setShowStorePins(s => !s)} style={{ width: 32, height: 16, borderRadius: 8, background: showStorePins ? '#1B4F8A' : '#CBD5E1', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: showStorePins ? 18 : 2, transition: 'left 0.2s' }} />
              </div>
              <span style={{ fontSize: 10, fontWeight: 700, color: showStorePins ? 'var(--navy)' : 'var(--muted)', flex: 1 }}>Projets SIGEPP-DPE</span>
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
        </div>

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
              <select className="form-input" style={{ fontSize: 11 }} value={filterProjet} onChange={e => setFilterProjet(e.target.value)}>
                <option value="tous">Tous les projets</option>
                {PIN_PROJETS.map(p => <option key={p.id} value={p.code}>{p.code.replace('PRJ-','')}</option>)}
              </select>
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
            <button onClick={handleRefresh} disabled={refreshing} className="btn btn-sm" style={{ background: refreshing ? '#EFF6FF' : 'transparent', border: '1px solid #7C3AED', color: '#7C3AED', justifyContent: 'center', fontSize: 11 }}>
              <RefreshCw size={10} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
              {refreshing ? 'Actualisation...' : lastRefresh ? `Actualisé ${lastRefresh}` : 'Actualiser carte'}
            </button>
          </div>
        </div>

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
              <button onClick={() => setShowArcgisConfig(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 6, width: 28, height: 28, cursor: 'pointer', display: 'grid', placeItems: 'center' }}><X size={15} /></button>
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
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
                      <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 200 }}>
                        <div style={{ fontSize: 9, color: color, fontWeight: 700, marginBottom: 2 }}>{p.code}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#0E3460', marginBottom: 4 }}>{p.nom}</div>
                        <div style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>{p.region}</div>
                        <div style={{ fontSize: 10, color: '#374151' }}>{p.description}</div>
                        <button
                          onClick={() => router.push(`/cockpit-projet?code=${encodeURIComponent(p.code)}`)}
                          className="btn btn-navy btn-sm"
                          style={{ marginTop: 8, width: '100%', justifyContent: 'center' }}>
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
                  <button onClick={() => setSelectedPin(null)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--muted)', padding: 0 }}><X size={12} /></button>
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
    </div>
  );
}
