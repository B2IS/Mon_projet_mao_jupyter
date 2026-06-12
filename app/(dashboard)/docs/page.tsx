'use client';

import { useEffect, useRef, useState } from 'react';
import { BookOpen, Wifi, WifiOff, RefreshCw, ExternalLink, Copy, Check } from 'lucide-react';
import { detectProvider, providerLabel, providerColor } from '@/lib/llmClient';
import type { ProviderStatus } from '@/lib/llmClient';

const NAVY   = '#1B4F8A';
const GREEN  = '#16A34A';
const AMBER  = '#D97706';
const PURPLE = '#8B5CF6';

/* ─── Swagger UI chargé dynamiquement ─────────────────────── */
declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    SwaggerUIBundle?: ((opts: Record<string, unknown>) => unknown) & { presets?: any; SwaggerUIStandalonePreset?: any };
  }
}

export default function DocsPage() {
  const swaggerRef    = useRef<HTMLDivElement>(null);
  const [loaded, setLoaded]         = useState(false);
  const [aiStatus, setAiStatus]     = useState<ProviderStatus | null>(null);
  const [copied, setCopied]         = useState<string | null>(null);

  /* Charge Swagger UI depuis unpkg (CDN) */
  useEffect(() => {
    const cssId = 'swagger-css';
    const jsId  = 'swagger-js';

    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id   = cssId;
      link.rel  = 'stylesheet';
      link.href = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById(jsId)) {
      const script = document.createElement('script');
      script.id  = jsId;
      script.src = 'https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js';
      script.onload = () => initSwagger();
      document.head.appendChild(script);
    } else if (window.SwaggerUIBundle) {
      initSwagger();
    }

    function initSwagger() {
      if (!swaggerRef.current || !window.SwaggerUIBundle) return;
      window.SwaggerUIBundle({
        url: '/api/openapi',
        domNode: swaggerRef.current,
        presets: [window.SwaggerUIBundle.presets?.apis, window.SwaggerUIBundle.SwaggerUIStandalonePreset],
        layout: 'BaseLayout',
        deepLinking: true,
        displayRequestDuration: true,
        defaultModelsExpandDepth: 1,
        defaultModelExpandDepth: 1,
        docExpansion: 'list',
        filter: true,
        syntaxHighlight: { activated: true, theme: 'monokai' },
      });
      setLoaded(true);
    }

    detectProvider().then(setAiStatus);
  }, []);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  const envVars = [
    { key: 'OLLAMA_BASE_URL', value: 'http://localhost:11434', desc: 'URL Ollama (défaut: localhost)' },
    { key: 'NEXT_PUBLIC_GROQ_API_KEY', value: 'gsk_...', desc: 'Clé Groq (fallback cloud)' },
    { key: 'NEXT_PUBLIC_SIGEPP_API', value: 'http://localhost:4000/api', desc: 'URL backend NestJS' },
    { key: 'AZURE_OPENAI_ENDPOINT', value: 'https://<resource>.openai.azure.com', desc: 'Azure OpenAI' },
    { key: 'AZURE_OPENAI_KEY', value: 'sk_...', desc: 'Clé Azure OpenAI' },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#F8FAFD', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── En-tête ──────────────────────────────────────────────── */}
      <div style={{ background: '#fff', borderBottom: '1px solid #E2E8F0', padding: '16px 24px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: `${NAVY}15`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <BookOpen size={20} style={{ color: NAVY }} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0F172A' }}>
                Documentation API — SIGEPP-DPE
              </h1>
              <p style={{ margin: '2px 0 0', fontSize: 12, color: '#64748B' }}>
                OpenAPI 3.0 · v2.0.0 · Architecture souveraine Senelec
              </p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {aiStatus && (
              <span style={{
                fontSize: 11.5, fontWeight: 700, padding: '5px 12px', borderRadius: 20,
                background: `${providerColor(aiStatus.provider)}18`,
                color: providerColor(aiStatus.provider),
                border: `1px solid ${providerColor(aiStatus.provider)}40`,
                display: 'flex', alignItems: 'center', gap: 5,
              }}>
                {aiStatus.available ? <Wifi size={12} /> : <WifiOff size={12} />}
                {providerLabel(aiStatus.provider)}
                {aiStatus.models.length > 0 && <span style={{ opacity: 0.7 }}>· {aiStatus.models.length} modèle(s)</span>}
              </span>
            )}
            <a
              href="/api/openapi"
              target="_blank"
              style={{
                display: 'flex', alignItems: 'center', gap: 5, padding: '6px 14px',
                borderRadius: 7, border: '1px solid #E2E8F0', background: '#fff',
                fontSize: 12, fontWeight: 600, color: '#475569', textDecoration: 'none',
              }}
            >
              <ExternalLink size={12} /> Spec JSON
            </a>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Bandeaux d'info ──────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>

          {/* Souveraineté */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 18px', borderLeft: `4px solid ${GREEN}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              🛡 Architecture souveraine
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              Déployable en <strong>air-gap total</strong> sur infrastructure Senelec.
              Aucune donnée projet ne quitte le réseau interne en mode Ollama.
              Tous les modèles IA sont <strong>open-source</strong> et chargés localement.
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {['Ollama', 'Mistral', 'Llama 3.x', 'Qwen 2.5', 'Phi-3'].map(m => (
                <span key={m} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: '#DCFCE7', color: GREEN, fontWeight: 700 }}>{m}</span>
              ))}
            </div>
          </div>

          {/* Déploiement rapide */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 18px', borderLeft: `4px solid ${NAVY}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              🚀 Déploiement rapide
            </div>
            <div style={{ fontSize: 12, color: '#475569', lineHeight: 1.6 }}>
              <strong>3 étapes</strong> pour un déploiement en environnement critique :
            </div>
            <ol style={{ margin: '8px 0 0 16px', padding: 0, fontSize: 12, color: '#475569', lineHeight: 1.8 }}>
              <li>Installer Ollama + modèle Mistral (<code>ollama pull mistral</code>)</li>
              <li>Configurer <code>.env.local</code> (variables ci-dessous)</li>
              <li><code>npm run build && npm start</code> (ou Docker)</li>
            </ol>
          </div>

          {/* Statut IA */}
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', padding: '16px 18px', borderLeft: `4px solid ${PURPLE}` }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#0F172A', marginBottom: 8 }}>
              🤖 Statut moteur IA
            </div>
            {aiStatus ? (
              <>
                <div style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                  Provider actif : <strong style={{ color: providerColor(aiStatus.provider) }}>{providerLabel(aiStatus.provider)}</strong>
                </div>
                {aiStatus.models.length > 0 ? (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {aiStatus.models.slice(0, 4).map(m => (
                      <span key={m.id} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 6, background: '#EDE9FE', color: PURPLE, fontWeight: 700 }}>{m.id}</span>
                    ))}
                    {aiStatus.models.length > 4 && (
                      <span style={{ fontSize: 10.5, color: '#94A3B8' }}>+{aiStatus.models.length - 4} autre(s)</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 11.5, color: '#EF3340', fontWeight: 600 }}>
                    ⚠ Aucun modèle disponible — démarrer Ollama ou configurer Groq
                  </div>
                )}
              </>
            ) : (
              <div style={{ fontSize: 12, color: '#94A3B8' }}>Détection en cours…</div>
            )}
          </div>
        </div>

        {/* ── Variables d'environnement ──────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #F1F5F9', fontSize: 13, fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: 8 }}>
            ⚙ Variables d'environnement (<code style={{ fontSize: 11, background: '#F8FAFD', padding: '1px 6px', borderRadius: 4 }}>.env.local</code>)
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#F8FAFD' }}>
                  {['Variable', 'Valeur exemple', 'Description', ''].map(h => (
                    <th key={h} style={{ padding: '8px 14px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#64748B', borderBottom: '1px solid #F1F5F9' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envVars.map((v, i) => (
                  <tr key={v.key} style={{ borderBottom: i < envVars.length - 1 ? '1px solid #F8FAFD' : 'none' }}>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11.5, color: NAVY, fontWeight: 700, whiteSpace: 'nowrap' }}>{v.key}</td>
                    <td style={{ padding: '9px 14px', fontFamily: 'monospace', fontSize: 11, color: '#64748B', whiteSpace: 'nowrap' }}>{v.value}</td>
                    <td style={{ padding: '9px 14px', color: '#475569', minWidth: 200 }}>{v.desc}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <button
                        onClick={() => copy(`${v.key}=${v.value}`, v.key)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '2px 6px', borderRadius: 4 }}
                      >
                        {copied === v.key ? <Check size={11} style={{ color: GREEN }} /> : <Copy size={11} />}
                        {copied === v.key ? 'Copié' : 'Copier'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Commandes Ollama rapides ──────────────────────────── */}
        <div style={{ background: '#0F172A', borderRadius: 12, padding: '16px 20px', color: '#E2E8F0' }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 12, color: '#94A3B8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            Installation Ollama — commandes rapides
          </div>
          {[
            { label: 'Installer Ollama (Linux/macOS)', cmd: 'curl -fsSL https://ollama.ai/install.sh | sh' },
            { label: 'Modèle recommandé (Mistral — excellent en français)', cmd: 'ollama pull mistral' },
            { label: 'Modèle léger (Phi-3 — serveurs sans GPU)', cmd: 'ollama pull phi3' },
            { label: 'Modèle puissant (Llama 3.1 70B — si GPU ≥ 48GB VRAM)', cmd: 'ollama pull llama3.1:70b' },
            { label: 'Démarrer le serveur Ollama', cmd: 'ollama serve' },
            { label: 'Tester le chat', cmd: "ollama run mistral 'Bonjour, es-tu prêt pour SIGEPP ?'" },
          ].map(({ label, cmd }) => (
            <div key={cmd} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, color: '#64748B', marginBottom: 3 }}># {label}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#1E293B', borderRadius: 6, padding: '7px 12px' }}>
                <code style={{ flex: 1, fontSize: 12, color: '#7DD3FC', fontFamily: 'monospace', wordBreak: 'break-all' }}>{cmd}</code>
                <button
                  onClick={() => copy(cmd, cmd)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748B', flexShrink: 0, padding: 2 }}
                >
                  {copied === cmd ? <Check size={12} style={{ color: GREEN }} /> : <Copy size={12} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* ── Swagger UI ──────────────────────────────────────────── */}
        <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #E2E8F0', overflow: 'hidden' }}>
          <div style={{ padding: '12px 18px', borderBottom: '1px solid #F1F5F9', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>
              Explorer l'API — Interface Swagger
            </div>
            {!loaded && (
              <div style={{ fontSize: 11.5, color: '#94A3B8', display: 'flex', alignItems: 'center', gap: 5 }}>
                <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Chargement Swagger UI…
              </div>
            )}
          </div>
          <style>{`
            @keyframes spin { to { transform: rotate(360deg); } }
            .swagger-ui .topbar { display: none; }
            .swagger-ui .info { margin: 20px 0 0; }
            .swagger-ui .info .title { font-size: 18px; font-weight: 800; color: #0F172A; }
            .swagger-ui .scheme-container { background: #F8FAFD; border-bottom: 1px solid #E2E8F0; }
            .swagger-ui select { border-radius: 6px; border-color: #E2E8F0; }
            .swagger-ui .btn.execute { background: #1B4F8A; border-color: #1B4F8A; border-radius: 7px; }
            .swagger-ui .btn.authorize { border-color: #16A34A; color: #16A34A; border-radius: 7px; }
            .swagger-ui .opblock-tag { font-weight: 700; font-size: 14px; }
            .swagger-ui .opblock.opblock-post .opblock-summary { border-color: #F47920; }
            .swagger-ui .opblock.opblock-get  .opblock-summary { border-color: #1B4F8A; }
          `}</style>
          <div ref={swaggerRef} style={{ padding: '0 10px 20px', minHeight: 200 }} />
        </div>

      </div>
    </div>
  );
}
