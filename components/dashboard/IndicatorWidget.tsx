'use client';

/**
 * IndicatorWidget — Affiche les indicateurs personnalisés créés dans le
 * Constructeur d'Indicateurs. Peut être embarqué sur n'importe quelle page.
 */

import { useState } from 'react';
import { TrendingUp, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useIndicatorStore, evaluateFormula, formatIndicator, ragStatus, RAG_COLORS } from '@/lib/indicatorStore';
import { useProjectStore } from '@/lib/projectStore';

interface IndicatorWidgetProps {
  /** Nombre max d'indicateurs à afficher (défaut: tous) */
  maxItems?: number;
  /** Titre du bloc */
  title?: string;
  /** Afficher le lien "Gérer" */
  showLink?: boolean;
  /** Affichage compact (cartes petites) */
  compact?: boolean;
}

export default function IndicatorWidget({
  maxItems,
  title = 'Indicateurs personnalisés',
  showLink = true,
  compact = false,
}: IndicatorWidgetProps) {
  const router = useRouter();
  const { indicators } = useIndicatorStore();
  const { projets } = useProjectStore();
  const [collapsed, setCollapsed] = useState(false);

  if (indicators.length === 0) return null;

  const projetsData = projets.map(p => ({
    budget: p.budget ?? 0,
    budgetEngage: p.budgetEngage ?? 0,
    budgetDecaisse: p.budgetDecaisse ?? 0,
    avancement: p.avancement ?? 0,
    avancementPlanifie: p.avancementPlanifie ?? 0,
    avancementReel: p.avancementReel,
    cpi: p.cpi ?? 1,
    spi: p.spi ?? 1,
    statut: p.statut ?? '',
  }));

  const visible = maxItems ? indicators.slice(0, maxItems) : indicators;

  return (
    <div style={{
      border: '1px solid #E2E8F0',
      borderRadius: 14,
      background: '#fff',
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(0,0,0,.06)',
      marginBottom: 24,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: compact ? '10px 16px' : '14px 20px',
        borderBottom: collapsed ? 'none' : '1px solid #F1F5F9',
        background: 'linear-gradient(135deg, #2D1167 0%, #4C1D95 100%)',
      }}>
        <TrendingUp size={16} color="#C4B5FD" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', flex: 1 }}>{title}</span>
        <span style={{ fontSize: 11, color: '#C4B5FD', fontWeight: 500 }}>
          {indicators.length} indicateur{indicators.length > 1 ? 's' : ''}
        </span>
        {showLink && (
          <button
            onClick={() => router.push('/constructeur-indicateurs')}
            title="Gérer les indicateurs"
            style={{ background: 'rgba(255,255,255,0.12)', border: 'none', borderRadius: 6, padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, color: '#C4B5FD', fontSize: 11, fontWeight: 600 }}>
            <ExternalLink size={11} /> Gérer
          </button>
        )}
        <button
          onClick={() => setCollapsed(v => !v)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: '#C4B5FD', display: 'flex' }}>
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {/* Cards */}
      {!collapsed && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: compact
            ? 'repeat(auto-fill, minmax(140px, 1fr))'
            : 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: compact ? 8 : 12,
          padding: compact ? 12 : 16,
        }}>
          {visible.map(ind => {
            const evalResult = evaluateFormula(ind.formula, projetsData);
            const val = evalResult.value;
            const rag = ragStatus(val, ind.thresholds);
            const ragColor = RAG_COLORS[rag];
            const formatted = formatIndicator(val, ind.unit);
            const pct = ind.target && ind.target > 0 ? Math.min(100, (val / ind.target) * 100) : null;

            return (
              <div key={ind.id} style={{
                borderRadius: 10,
                border: `1px solid ${ragColor}30`,
                borderTop: `3px solid ${ragColor}`,
                background: `${ragColor}08`,
                padding: compact ? '10px 12px' : '14px 16px',
              }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ind.name}
                </div>
                <div style={{ fontSize: compact ? 18 : 22, fontWeight: 900, color: ragColor, lineHeight: 1.1, marginBottom: 2 }}>
                  {formatted}
                </div>
                {ind.target && (
                  <div style={{ fontSize: 10, color: '#94A3B8', marginBottom: 6 }}>
                    Cible : {formatIndicator(ind.target, ind.unit)}
                  </div>
                )}
                {pct !== null && (
                  <div style={{ height: 3, background: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: ragColor, borderRadius: 2, transition: 'width .4s' }} />
                  </div>
                )}
              </div>
            );
          })}
          {maxItems && indicators.length > maxItems && (
            <div
              onClick={() => router.push('/constructeur-indicateurs')}
              style={{
                borderRadius: 10, border: '1.5px dashed #E2E8F0', display: 'flex',
                alignItems: 'center', justifyContent: 'center', gap: 6,
                cursor: 'pointer', color: '#94A3B8', fontSize: 12, fontWeight: 600,
                padding: compact ? '10px 12px' : '14px 16px', minHeight: 72,
              }}>
              +{indicators.length - maxItems} autres
            </div>
          )}
        </div>
      )}
    </div>
  );
}
