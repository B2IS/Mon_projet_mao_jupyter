'use client';
/**
 * ProjetsCarteLeaflet — Carte SIG interactive (Leaflet/OpenStreetMap) des projets DPE.
 * Remplace l'ancien fond SVG « dessiné » par un vrai socle cartographique (type utility).
 * • Tuiles OSM réelles (fond clair lisible).
 * • Un marqueur par projet, positionné sur sa région (jitter si plusieurs/région).
 * • Couleur = domaine ; popup = référence SIG, code, avancement, budget.
 * • Couches ArcGIS Enterprise superposées si une configuration active existe
 *   (localStorage `sigepp-arcgis-config`).
 *
 * À importer dynamiquement (ssr:false) — Leaflet touche `window`.
 */
import { useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { DOMAINE_CFG, STATUT_CFG } from '@/lib/projectStore';

export interface CartePin {
  id: string;
  nom: string;
  code: string;
  region: string;
  domaine: string;
  statut: string;
  avancement: number;
  budget: number;          // MFCFA
  localisation?: string;
  lat?: number;
  lng?: number;
  refSIG?: string;          // référence SIG de l'élément terrain
}

/** Coordonnées réelles (lat, lng) des chefs-lieux de région du Sénégal. */
const REGION_LATLNG: Record<string, [number, number]> = {
  'Dakar':         [14.7167, -17.4677],
  'Thiès':         [14.7910, -16.9359],
  'Diourbel':      [14.6549, -16.2314],
  'Saint-Louis':   [16.0179, -16.4896],
  'Louga':         [15.6140, -16.2240],
  'Matam':         [15.6559, -13.2554],
  'Tambacounda':   [13.7707, -13.6673],
  'Kédougou':      [12.5605, -12.1747],
  'Kolda':         [12.8939, -14.9410],
  'Sédhiou':       [12.7081, -15.5569],
  'Ziguinchor':    [12.5641, -16.2719],
  'Fatick':        [14.3390, -16.4110],
  'Kaolack':       [14.1652, -16.0726],
  'Kaffrine':      [14.1059, -15.5508],
  'Multi-régions': [14.4974, -14.4524],
  'Thiès / Louga': [15.2000, -16.5000],
};

const CENTER: [number, number] = [14.6, -14.8];

function domColor(d: string): string {
  return (DOMAINE_CFG as Record<string, { color: string }>)[d]?.color ?? '#1B4F8A';
}

interface ArcgisConfig { serviceUrl?: string; enabled?: boolean; layers?: string; }

export default function ProjetsCarteLeaflet({
  projets, height = 360, onSelect,
}: {
  projets: CartePin[];
  height?: number;
  onSelect?: (id: string) => void;
}) {
  // Lecture (sans crash SSR car composant client) de la config ArcGIS active.
  const arcgis = useMemo<ArcgisConfig | null>(() => {
    try {
      const raw = window.localStorage.getItem('sigepp-arcgis-config');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }, []);

  // Positionne chaque projet : coordonnées propres si présentes, sinon région + jitter.
  const pins = useMemo(() => {
    const perRegion: Record<string, number> = {};
    return projets.map(p => {
      if (typeof p.lat === 'number' && typeof p.lng === 'number') {
        return { ...p, _lat: p.lat, _lng: p.lng };
      }
      const base = REGION_LATLNG[p.region] ?? REGION_LATLNG['Multi-régions'];
      const n = perRegion[p.region] = (perRegion[p.region] ?? 0) + 1;
      // Spirale de décalage pour éviter la superposition exacte
      const angle = n * 1.2;
      const rad = n === 1 ? 0 : 0.06 + n * 0.02;
      return { ...p, _lat: base[0] + Math.sin(angle) * rad, _lng: base[1] + Math.cos(angle) * rad };
    });
  }, [projets]);

  const arcgisOn = !!arcgis?.enabled && !!arcgis?.serviceUrl;

  return (
    <div style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', border: '1px solid #E2E8F0' }}>
      <MapContainer center={CENTER} zoom={7} style={{ width: '100%', height: '100%' }} scrollWheelZoom={false}>
        <LayersControl position="topright">
          <LayersControl.BaseLayer checked name="Plan (OSM)">
            <TileLayer
              attribution='&copy; OpenStreetMap'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </LayersControl.BaseLayer>
          <LayersControl.BaseLayer name="Satellite (Esri)">
            <TileLayer
              attribution='Tiles &copy; Esri'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            />
          </LayersControl.BaseLayer>
          {arcgisOn && (
            <LayersControl.Overlay checked name={`ArcGIS SENELEC — ${arcgis?.layers ?? 'réseau'}`}>
              <TileLayer
                url={`${arcgis!.serviceUrl!.replace(/\/$/, '')}/tile/{z}/{y}/{x}`}
                opacity={0.75}
              />
            </LayersControl.Overlay>
          )}
        </LayersControl>

        {pins.map(p => {
          const c = domColor(p.domaine);
          const late = p.statut === 'en_retard';
          return (
            <CircleMarker
              key={p.id}
              center={[(p as any)._lat, (p as any)._lng]}
              radius={9}
              pathOptions={{ fillColor: c, fillOpacity: 0.85, color: late ? '#EF3340' : '#fff', weight: late ? 3 : 2 }}
              eventHandlers={{ click: () => onSelect?.(p.id) }}
            >
              <Popup>
                <div style={{ minWidth: 200, fontFamily: 'Inter,system-ui,sans-serif' }}>
                  <div style={{ fontSize: 9, color: c, fontWeight: 700, fontFamily: 'monospace' }}>{p.code}</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', margin: '2px 0 4px' }}>{p.nom}</div>
                  <div style={{ fontSize: 10.5, color: '#64748B', marginBottom: 6 }}>
                    {p.localisation || p.region} · {p.region}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#94A3B8' }}>Domaine</span>
                    <span style={{ color: c, fontWeight: 700 }}>
                      {(DOMAINE_CFG as Record<string, { emoji: string; label: string }>)[p.domaine]?.emoji} {(DOMAINE_CFG as Record<string, { label: string }>)[p.domaine]?.label ?? p.domaine}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 3 }}>
                    <span style={{ color: '#94A3B8' }}>Statut</span>
                    <span style={{ fontWeight: 700, color: (STATUT_CFG as Record<string, { color: string }>)[p.statut]?.color ?? '#334155' }}>
                      {(STATUT_CFG as Record<string, { label: string }>)[p.statut]?.label ?? p.statut}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                    <span style={{ color: '#94A3B8' }}>Avancement</span>
                    <b style={{ color: p.avancement >= 70 ? '#16A34A' : p.avancement >= 40 ? '#F47920' : '#EF3340' }}>{p.avancement}%</b>
                  </div>
                  <div style={{ height: 4, borderRadius: 99, background: '#E5E7EB', overflow: 'hidden', marginBottom: 6 }}>
                    <div style={{ width: `${p.avancement}%`, height: '100%', background: p.avancement >= 70 ? '#16A34A' : p.avancement >= 40 ? '#F47920' : '#EF3340' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                    <span style={{ color: '#94A3B8' }}>Réf. SIG</span>
                    <span style={{ fontFamily: 'monospace', color: '#1B4F8A' }}>{p.refSIG ?? `SIG-${p.code}`}</span>
                  </div>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>
    </div>
  );
}
