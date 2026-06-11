'use client';
import { useState } from 'react';
import { Bot, Sparkles } from 'lucide-react';
import AIMultimodalChat from '@/components/ui/AIMultimodalChat';
import Copilot from '@/components/dashboard/Copilot';

type Tab = 'assistant' | 'copilot';

export default function CentreIAPage() {
  const [tab, setTab] = useState<Tab>('assistant');

  const tabs: { id: Tab; label: string; icon: typeof Bot }[] = [
    { id: 'assistant', label: 'Assistant IA',  icon: Bot      },
    { id: 'copilot',   label: 'Copilot DPE',   icon: Sparkles },
  ];

  return (
    <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
      <div style={{ padding: '14px 18px 0', borderBottom: '1px solid #E2E8F0', background: '#fff' }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: '#2D1167', marginBottom: 2 }}>Centre IA & Copilot</div>
        <div style={{ fontSize: 12, color: '#64748B', marginBottom: 10 }}>
          Assistant IA multimodal · Copilot M365 — bornés à votre périmètre organisationnel.
          Pour l&apos;analyse multi-agents d&apos;un projet, rendez-vous dans <strong>Migration IA</strong>.
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(t => {
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
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0, ...(tab === 'assistant' ? { overflowY: 'auto', padding: 16 } : {}) }}>
        {tab === 'assistant' && <AIMultimodalChat />}
        {tab === 'copilot'   && <Copilot />}
      </div>
    </main>
  );
}
