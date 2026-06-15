'use client';
import Link from 'next/link';

export default function NotFound() {
  return (
    <div style={{
      minHeight: '100dvh',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(150deg, #140830 0%, #2D1167 50%, #3D1A6B 100%)',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
      padding: '24px',
      textAlign: 'center',
    }}>
      <div style={{
        fontSize: 96, fontWeight: 900, color: 'rgba(255,255,255,0.08)',
        lineHeight: 1, letterSpacing: '-4px', userSelect: 'none',
      }}>404</div>
      <div style={{ marginTop: -16, fontSize: 22, fontWeight: 700, color: '#fff' }}>
        Page introuvable
      </div>
      <p style={{ marginTop: 8, fontSize: 14, color: 'rgba(255,255,255,0.55)', maxWidth: 360 }}>
        Cette page n'existe pas ou vous n'avez pas les droits pour y accéder.
      </p>
      <Link href="/tableau-de-bord" style={{
        marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 8,
        background: '#F47920', color: '#fff',
        padding: '10px 22px', borderRadius: 8,
        fontWeight: 600, fontSize: 14, textDecoration: 'none',
        transition: 'opacity 0.15s',
      }}>
        ← Retour au tableau de bord
      </Link>
    </div>
  );
}
