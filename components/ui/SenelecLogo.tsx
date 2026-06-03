'use client';

/* ════════════════════════════════════════════════════════════════════════════
   SenelecLogo — logo officiel SENELEC (fichier SVG original).
   Le fichier original provient de Documents_SIGEP_DPE/senelec_trace-gradient.svg
   et a été copié dans public/images/logo-senelec.svg.
═══════════════════════════════════════════════════════════════════════════════ */

export default function SenelecLogo({ size = 64, withText = false }: { size?: number; withText?: boolean }) {
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <img
        src="/images/logo-senelec.svg"
        alt="Senelec"
        width={size}
        height={size * 0.817}
        style={{ display: 'block', objectFit: 'contain' }}
      />
      {withText && (
        <span
          style={{
            fontFamily: "'Helvetica Neue', Arial, sans-serif",
            fontSize: size * 0.18,
            fontWeight: 800,
            color: '#1F6FB2',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          SIGEPP·DPE
        </span>
      )}
    </div>
  );
}
