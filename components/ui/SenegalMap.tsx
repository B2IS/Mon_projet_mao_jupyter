'use client';

import { useState, useMemo } from 'react';
import { DOMAINE_CFG, STATUT_CFG } from '@/lib/projectStore';

/* ─── Types ─────────────────────────────────────────────────────────────────── */
interface ProjectPin {
  id: string;
  nom: string;
  code: string;
  region: string;
  domaine: string;
  statut: string;
  avancement: number;
  budget: number;
}

interface SenegalMapProps {
  projets?: ProjectPin[];
  selectedProjectId?: string;
  onProjectClick?: (id: string) => void;
  onRegionClick?: (region: string) => void;
  activeRegion?: string;
  height?: number;
  showLegend?: boolean;
  title?: string;
}

/* ─── Region coordinates (SVG space: viewBox 0 0 490 415) ──────────────────── */
const REGION_CENTERS: Record<string, { x: number; y: number }> = {
  'Dakar':           { x: 52,  y: 186 },
  'Thiès':           { x: 95,  y: 183 },
  'Diourbel':        { x: 122, y: 186 },
  'Saint-Louis':     { x: 124, y: 68  },
  'Louga':           { x: 160, y: 118 },
  'Matam':           { x: 338, y: 108 },
  'Tambacounda':     { x: 322, y: 238 },
  'Kédougou':        { x: 408, y: 322 },
  'Kolda':           { x: 215, y: 328 },
  'Sédhiou':         { x: 155, y: 340 },
  'Ziguinchor':      { x: 88,  y: 352 },
  'Fatick':          { x: 127, y: 222 },
  'Kaolack':         { x: 163, y: 234 },
  'Kaffrine':        { x: 218, y: 224 },
  'Multi-régions':   { x: 240, y: 165 },
  'Thiès / Louga':   { x: 128, y: 148 },
};

/* ─── Senegal main outline path ─────────────────────────────────────────────── */
// Simplified but recognizable Senegal shape (clockwise from NW coast)
const SENEGAL_PATH = `
  M 92,68
  L 75,70 L 62,72
  L 50,80 L 48,180
  L 50,195 L 52,228
  L 60,268
  L 70,295
  L 75,325 L 82,335 L 100,342
  L 155,350 L 200,353 L 283,352
  L 360,350 L 420,340
  L 440,245 L 444,125 L 438,35
  L 415,25 L 300,28 L 172,40 L 92,68 Z
`;

// Gambia overlay (The Gambia sits within Senegal)
const GAMBIA_PATH = `
  M 68,265 L 260,252 L 262,294 L 68,295 Z
`;

// Casamance (south of Gambia) - simplified
// Actually it's already part of the main polygon above

// Senegal River (decorative northern river line)
const SENEGAL_RIVER = `M 92,68 Q 240,35 438,35`;

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function SenegalMap({
  projets = [],
  selectedProjectId,
  onProjectClick,
  onRegionClick,
  activeRegion,
  height = 360,
  showLegend = true,
  title,
}: SenegalMapProps) {
  const [hoveredProjectId, setHoveredProjectId] = useState<string | null>(null);
  const [hoveredRegion, setHoveredRegion] = useState<string | null>(null);

  /* Group projects by region */
  const projectsByRegion = useMemo(() => {
    const map: Record<string, ProjectPin[]> = {};
    projets.forEach(p => {
      const region = p.region in REGION_CENTERS ? p.region : 'Multi-régions';
      if (!map[region]) map[region] = [];
      map[region].push(p);
    });
    return map;
  }, [projets]);

  /* Hover tooltip state */
  const hoveredProject = hoveredProjectId
    ? projets.find(p => p.id === hoveredProjectId) ?? null
    : null;

  const aspect = 490 / 415; // viewBox aspect ratio
  const svgHeight = height;
  const svgWidth  = Math.round(height * aspect);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {title && (
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1B4F8A', display: 'flex', alignItems: 'center', gap: 6 }}>
          🗺️ {title}
        </div>
      )}

      <div style={{ position: 'relative', display: 'inline-block' }}>
        <svg
          viewBox="0 0 490 415"
          width={svgWidth}
          height={svgHeight}
          style={{ display: 'block', maxWidth: '100%' }}
        >
          {/* Ocean background */}
          <rect x="0" y="0" width="490" height="415" fill="#DBEAFE" rx="8" />

          {/* Country grid lines (subtle) */}
          {[50, 100, 150, 200, 250, 300, 350, 400, 450].map(x => (
            <line key={`vg${x}`} x1={x} y1="0" x2={x} y2="415" stroke="white" strokeWidth="0.5" strokeOpacity="0.4" />
          ))}
          {[50, 100, 150, 200, 250, 300, 350, 400].map(y => (
            <line key={`hg${y}`} x1="0" y1={y} x2="490" y2={y} stroke="white" strokeWidth="0.5" strokeOpacity="0.4" />
          ))}

          {/* Main Senegal territory */}
          <path
            d={SENEGAL_PATH}
            fill="#E8F4E8"
            stroke="#9CA3AF"
            strokeWidth="1.5"
          />

          {/* Active region highlight */}
          {(activeRegion || hoveredRegion) && (
            <circle
              cx={REGION_CENTERS[(activeRegion ?? hoveredRegion)!]?.x ?? 240}
              cy={REGION_CENTERS[(activeRegion ?? hoveredRegion)!]?.y ?? 160}
              r="35"
              fill="#1B4F8A"
              fillOpacity="0.12"
              stroke="#1B4F8A"
              strokeWidth="1"
              strokeDasharray="4 2"
            />
          )}

          {/* Senegal River (decorative) */}
          <path
            d={SENEGAL_RIVER}
            fill="none"
            stroke="#7DD3FC"
            strokeWidth="2"
            strokeOpacity="0.7"
          />

          {/* The Gambia */}
          <path
            d={GAMBIA_PATH}
            fill="#FDE68A"
            stroke="#D97706"
            strokeWidth="1"
            opacity="0.8"
          />
          <text x="148" y="283" fill="#92400E" fontSize="7" fontWeight="700" textAnchor="middle" fontFamily="Arial,sans-serif">GAMBIE</text>

          {/* Region dots (empty regions) */}
          {Object.entries(REGION_CENTERS).map(([region, pos]) => {
            const hasProjects = !!projectsByRegion[region];
            if (hasProjects) return null; // project pins will show instead
            return (
              <g
                key={region}
                style={{ cursor: onRegionClick ? 'pointer' : 'default' }}
                onClick={() => onRegionClick?.(region)}
                onMouseEnter={() => setHoveredRegion(region)}
                onMouseLeave={() => setHoveredRegion(null)}
              >
                <circle cx={pos.x} cy={pos.y} r="4" fill="#D1D5DB" stroke="white" strokeWidth="1" />
              </g>
            );
          })}

          {/* Project pins per region */}
          {Object.entries(projectsByRegion).map(([region, regionProjets]) => {
            const pos = REGION_CENTERS[region];
            if (!pos) return null;
            const totalBudget = regionProjets.reduce((s, p) => s + p.budget, 0);
            const avgAv = Math.round(regionProjets.reduce((s, p) => s + p.avancement, 0) / regionProjets.length);
            const hasCritical = regionProjets.some(p => p.statut === 'en_retard');
            const dominantDomaine = regionProjets[0]?.domaine ?? 'transport';
            const domaineColor = (DOMAINE_CFG as Record<string, { color: string }>)[dominantDomaine]?.color ?? '#1B4F8A';
            const pinSize = Math.max(8, Math.min(20, 8 + regionProjets.length * 3));
            const isSelected = regionProjets.some(p => p.id === selectedProjectId);
            const isHovered = regionProjets.some(p => p.id === hoveredProjectId);

            return (
              <g
                key={region}
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  if (onRegionClick) onRegionClick(region);
                  if (onProjectClick && regionProjets.length === 1) onProjectClick(regionProjets[0].id);
                }}
                onMouseEnter={() => {
                  setHoveredRegion(region);
                  if (regionProjets.length === 1) setHoveredProjectId(regionProjets[0].id);
                }}
                onMouseLeave={() => {
                  setHoveredRegion(null);
                  setHoveredProjectId(null);
                }}
              >
                {/* Pulse ring for critical projects */}
                {hasCritical && (
                  <circle cx={pos.x} cy={pos.y} r={pinSize + 5} fill="#EF3340" fillOpacity="0.15" stroke="#EF3340" strokeWidth="1" strokeOpacity="0.4" />
                )}

                {/* Pin circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={pinSize}
                  fill={isSelected || isHovered ? domaineColor : domaineColor + 'CC'}
                  stroke={isSelected ? '#fff' : hasCritical ? '#EF3340' : 'white'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                />

                {/* Project count */}
                <text
                  x={pos.x}
                  y={pos.y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="white"
                  fontSize={regionProjets.length > 9 ? 7 : 8}
                  fontWeight="800"
                  fontFamily="Arial,sans-serif"
                >
                  {regionProjets.length}
                </text>

                {/* Progress arc */}
                {(() => {
                  const r = pinSize + 4;
                  const circumference = 2 * Math.PI * r;
                  const dashLen = circumference * avgAv / 100;
                  return (
                    <circle
                      cx={pos.x} cy={pos.y}
                      r={r}
                      fill="none"
                      stroke={avgAv >= 70 ? '#16A34A' : avgAv >= 40 ? '#F47920' : '#EF3340'}
                      strokeWidth="2"
                      strokeDasharray={`${dashLen} ${circumference - dashLen}`}
                      strokeDashoffset={circumference * 0.25}
                      strokeLinecap="round"
                      opacity="0.7"
                    />
                  );
                })()}

                {/* Region label */}
                <text
                  x={pos.x}
                  y={pos.y + pinSize + 9}
                  textAnchor="middle"
                  fill="#374151"
                  fontSize="7"
                  fontWeight="600"
                  fontFamily="Arial,sans-serif"
                >
                  {region.length > 12 ? region.slice(0, 12) + '…' : region}
                </text>

                {/* Budget bubble on hover */}
                {isHovered && (
                  <g>
                    <rect
                      x={pos.x - 30} y={pos.y - pinSize - 26}
                      width={60} height={18}
                      rx={4} fill="#1E293B" fillOpacity="0.9"
                    />
                    <text
                      x={pos.x} y={pos.y - pinSize - 14}
                      textAnchor="middle"
                      fill="white"
                      fontSize="8"
                      fontFamily="Arial,sans-serif"
                    >
                      {(totalBudget / 1000).toFixed(0)} Mrd F · {avgAv}%
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Compass rose */}
          <g transform="translate(462, 52)">
            <circle cx="0" cy="0" r="14" fill="white" fillOpacity="0.85" stroke="#CBD5E1" strokeWidth="1" />
            <text x="0" y="-5" textAnchor="middle" fill="#374151" fontSize="8" fontWeight="700" fontFamily="Arial,sans-serif">N</text>
            <line x1="0" y1="-12" x2="0" y2="-3" stroke="#374151" strokeWidth="1.5" />
            <text x="0" y="9"  textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="Arial,sans-serif">S</text>
            <text x="-10" y="2" textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="Arial,sans-serif">O</text>
            <text x="10"  y="2" textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="Arial,sans-serif">E</text>
          </g>

          {/* Scale bar */}
          <g transform="translate(20, 395)">
            <line x1="0" y1="0" x2="60" y2="0" stroke="#374151" strokeWidth="1.5" />
            <line x1="0" y1="-3" x2="0" y2="3" stroke="#374151" strokeWidth="1.5" />
            <line x1="60" y1="-3" x2="60" y2="3" stroke="#374151" strokeWidth="1.5" />
            <text x="30" y="-5" textAnchor="middle" fill="#374151" fontSize="7" fontFamily="Arial,sans-serif">~200 km</text>
          </g>

          {/* Country label */}
          <text x="265" y="145" textAnchor="middle" fill="#374151" fontSize="14" fontWeight="700" fontFamily="Arial,sans-serif" opacity="0.35">SÉNÉGAL</text>

          {/* Mauritania label */}
          <text x="250" y="18" textAnchor="middle" fill="#9CA3AF" fontSize="8" fontFamily="Arial,sans-serif">MAURITANIE</text>

          {/* Mali label */}
          <text x="464" y="190" textAnchor="middle" fill="#9CA3AF" fontSize="8" fontFamily="Arial,sans-serif" transform="rotate(90, 464, 190)">MALI</text>

          {/* Atlantic Ocean label */}
          <text x="20" y="280" fill="#60A5FA" fontSize="9" fontFamily="Arial,sans-serif" fontStyle="italic">Océan</text>
          <text x="20" y="293" fill="#60A5FA" fontSize="9" fontFamily="Arial,sans-serif" fontStyle="italic">Atlantique</text>

          {/* Guinea-Bissau label */}
          <text x="80" y="410" textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="Arial,sans-serif">GUINÉE-BISSAU</text>

          {/* Guinea label */}
          <text x="410" y="408" textAnchor="middle" fill="#9CA3AF" fontSize="7" fontFamily="Arial,sans-serif">GUINÉE</text>
        </svg>

        {/* Tooltip panel */}
        {hoveredProject && (
          <div style={{
            position: 'absolute', top: 8, right: -220, width: 210,
            background: '#1E293B', borderRadius: 10, padding: '12px 14px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            color: '#fff', fontSize: 11, zIndex: 10, pointerEvents: 'none',
          }}>
            <div style={{ fontWeight: 800, fontSize: 12, marginBottom: 6, lineHeight: 1.3 }}>
              {hoveredProject.nom}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Code</span>
                <span style={{ fontFamily: 'monospace', color: '#7DD3FC' }}>{hoveredProject.code}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Région</span>
                <span>{hoveredProject.region}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Domaine</span>
                <span style={{ color: (DOMAINE_CFG as Record<string, { color: string; emoji: string }>)[hoveredProject.domaine]?.color ?? '#fff' }}>
                  {(DOMAINE_CFG as Record<string, { emoji: string; label: string }>)[hoveredProject.domaine]?.emoji} {(DOMAINE_CFG as Record<string, { label: string }>)[hoveredProject.domaine]?.label ?? hoveredProject.domaine}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Statut</span>
                <span style={{ color: (STATUT_CFG as Record<string, { color: string; label: string }>)[hoveredProject.statut]?.color ?? '#fff' }}>
                  {(STATUT_CFG as Record<string, { label: string }>)[hoveredProject.statut]?.label ?? hoveredProject.statut}
                </span>
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ color: '#94A3B8' }}>Avancement</span>
                  <span style={{ fontWeight: 700 }}>{hoveredProject.avancement}%</span>
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2 }}>
                  <div style={{
                    width: `${hoveredProject.avancement}%`, height: '100%', borderRadius: 2,
                    background: hoveredProject.avancement >= 70 ? '#16A34A' : hoveredProject.avancement >= 40 ? '#F47920' : '#EF3340',
                  }} />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 2 }}>
                <span style={{ color: '#94A3B8' }}>Budget</span>
                <span style={{ fontWeight: 700, color: '#FCD34D' }}>{hoveredProject.budget.toFixed(0)} MFCFA</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      {showLegend && projets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
          {Object.entries(DOMAINE_CFG).map(([key, cfg]) => {
            const count = projets.filter(p => p.domaine === key).length;
            if (count === 0) return null;
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: cfg.color, display: 'inline-block' }} />
                <span style={{ color: '#475569' }}>{cfg.emoji} {cfg.label.split('/')[0].trim()} <strong style={{ color: cfg.color }}>({count})</strong></span>
              </div>
            );
          })}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid #E2E8F0' }}>
            <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#FDE68A', border: '1px solid #D97706', display: 'inline-block' }} />
            <span style={{ color: '#475569' }}>Gambie</span>
          </div>
        </div>
      )}
    </div>
  );
}
