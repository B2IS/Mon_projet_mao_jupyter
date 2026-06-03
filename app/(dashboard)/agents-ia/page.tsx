'use client';
/**
 * Centre IA — hub unique regroupant les capacités d'intelligence artificielle
 * (au lieu de 3 entrées de menu séparées) :
 *   • Assistant IA (agents de rôle, multimodal)   — tous les profils
 *   • Copilot Microsoft 365                        — tous les profils
 *   • Migration IA (Project Factory)               — profils habilités uniquement
 * La sécurité organisationnelle s'applique dans chaque outil (périmètre du demandeur).
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Sparkles, Upload, ArrowRight } from 'lucide-react';
import AIMultimodalChat from '@/components/ui/AIMultimodalChat';
import Copilot from '@/components/dashboard/Copilot';
import { useAuth, canAccessNavItem } from '@/lib/authStore';

type Tab = 'assistant' | 'copilot' | 'migration';

export default function CentreIAPage() {
  const router = useRouter();
  const { user } = useAuth();
  const canMigrate = user ? canAccessNavItem(user.role, '/migration') : true;
  const [tab, setTab] = useState<Tab>('assistant');

  const tabs: { id: Tab; label: string; icon: typeof Bot; show: boolean }[] = [
    { id: 'assistant', label: 'Assistant IA', icon: Bot, show: true },
    { id: 'copilot', label: 'Copilot Microsoft 365', icon: Sparkles, show: true },
    { id: 'migration', label: 'Migration IA', icon: Upload, show: canMigrate },
  ];

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      {/* En-tête + onglets */}
      <div style={{ padding: '14px 18px 0', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#2D1167', marginBottom: 2 }}>Centre IA</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
          Assistants IA, Copilot M365 et Project Factory — bornés à votre périmètre organisationnel.
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.filter(t => t.show).map(t => {
            const Icon = t.icon; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', border: 'none',
                borderBottom: active ? '2.5px solid #F47920' : '2.5px solid transparent',
                background: 'transparent', color: active ? '#2D1167' : '#64748B',
                fontSize: 13, fontWeight: active ? 800 : 600, cursor: 'pointer', fontFamily: 'inherit',
              }}><Icon size={15} /> {t.label}</button>
            );
          })}
        </div>
      </div>

      {/* Contenu de l'onglet */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflowY: 'auto', minHeight: 0, padding: 16 }}>
        {tab === 'assistant' && <AIMultimodalChat />}
        {tab === 'copilot' && <Copilot />}
        {tab === 'migration' && canMigrate && (
          <div style={{ margin: 'auto', maxWidth: 520, textAlign: 'center', padding: 32 }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#EEF2FF', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <Upload size={30} color="#2D1167" />
            </div>
            <div style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>Migration IA — Project Factory</div>
            <p style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6, marginBottom: 20 }}>
              Importez DAO, contrats, études, Excel, MS Project — l'IA propose Fiche projet, WBS, planning,
              budget, risques, KPI et GED. <b>Validation humaine obligatoire</b> avant création.
            </p>
            <button onClick={() => router.push('/migration')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px', borderRadius: 10,
              background: '#2D1167', color: '#fff', border: 'none', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            }}>Ouvrir l&apos;assistant de migration <ArrowRight size={16} /></button>
          </div>
        )}
      </div>
    </main>
  );
}
