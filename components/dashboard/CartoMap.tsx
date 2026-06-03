'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import type { ProjetDPE, TypeProjet, StatutProjet } from '@/lib/types';

const TYPE_COLOR: Record<TypeProjet, string> = {
  // Production
  production_renouv:       '#F97316',
  production_conv:         '#34D399',
  // Transport
  transport:               '#A78BFA',
  // Distribution
  distribution:            '#60A5FA',
  // Commercial
  commercial:              '#FBBF24',
  smartgrid:               '#FBBF24', // smart grid commercial → même domaine
  // Électricité (accès)
  electrification_rurale:  '#D97706',
  // Autres
  autre:                   '#6B7280',
};

const STATUT_COLOR: Record<StatutProjet, string> = {
  etude:                '#60A5FA',
  appel_offres:         '#A78BFA',
  en_cours:             '#F7941D',
  suspendu:             '#F59E0B',
  reception_provisoire: '#10B981',
  reception_definitive: '#34D399',
  cloture:              '#6B7280',
};

function FlyTo({ s }: { s: { lat: number; lng: number } | null }) {
  const map = useMap();
  useEffect(() => {
    if (s) map.flyTo([s.lat, s.lng], 9, { animate: true, duration: 1.2 });
  }, [s, map]);
  return null;
}

export default function CartoMap({ projets, onSelect, selected }: {
  projets: ProjetDPE[];
  onSelect: (p: ProjetDPE | null) => void;
  selected: ProjetDPE | null;
}) {
  return (
    <MapContainer center={[14.4974, -14.4524]} zoom={6}
      style={{ width: '100%', height: '100%', background: '#050810' }} attributionControl={false}>
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
      <FlyTo s={selected} />
      {projets.map(p => {
        const isSel = selected?.id === p.id;
        const dc = TYPE_COLOR[p.type] ?? '#6B7280';
        const sc = STATUT_COLOR[p.statut] ?? '#F7941D';
        const incOpen = p.incidents.filter(i => i.statut !== 'resolu').length;
        return (
          <CircleMarker key={p.id} center={[p.lat, p.lng]} radius={isSel ? 18 : 11}
            pathOptions={{ fillColor: dc, fillOpacity: isSel ? 0.95 : 0.75, color: sc, weight: isSel ? 3 : 2 }}
            eventHandlers={{ click: () => onSelect(p) }}>
            <Popup>
              <div style={{ fontFamily: 'Inter,sans-serif', minWidth: 210, background: 'transparent' }}>
                <div style={{ fontSize: 9, color: '#F7941D', fontFamily: 'monospace', fontWeight: 700, marginBottom: 2 }}>{p.code}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#EFF6FF', fontFamily: 'Rajdhani,sans-serif', marginBottom: 4 }}>{p.intitule}</div>
                <div style={{ fontSize: 10, color: '#7AA2C0', marginBottom: 6 }}>{p.localite}, {p.region}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 4 }}>
                  <span style={{ color: '#7AA2C0' }}>Avancement</span>
                  <b style={{ color: p.avancement >= 70 ? '#10B981' : p.avancement >= 40 ? '#F7941D' : '#EF4444', fontFamily: 'Rajdhani,sans-serif' }}>{p.avancement}%</b>
                </div>
                <div style={{ height: 4, borderRadius: 99, background: '#182436', overflow: 'hidden', marginBottom: 6 }}>
                  <div style={{ width: `${p.avancement}%`, height: '100%', borderRadius: 99, background: p.avancement >= 70 ? '#10B981' : p.avancement >= 40 ? '#F7941D' : '#EF4444' }} />
                </div>
                {incOpen > 0 && <div style={{ fontSize: 10, color: '#F97316' }}>⚠ {incOpen} incident(s) ouvert(s)</div>}
              </div>
            </Popup>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
