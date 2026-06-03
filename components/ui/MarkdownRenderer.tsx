/**
 * MarkdownRenderer.tsx — Renderer Markdown riche
 * Support : titres, paragraphes, tableaux, listes, code blocks, gras, italique, liens
 * Utilisé pour afficher les réponses longues de l'IA avec mise en forme professionnelle
 */

'use client';

import React, { useMemo } from 'react';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export default function MarkdownRenderer({ content, className = '' }: MarkdownRendererProps) {
  const elements = useMemo(() => parseMarkdown(content), [content]);

  return (
    <div className={`markdown-body ${className}`} style={styles.container}>
      {elements}
    </div>
  );
}

// ─── Parser Markdown simplifié mais complet ────────────────────────────────

function parseMarkdown(md: string): React.ReactNode[] {
  const lines = md.split('\n');
  const result: React.ReactNode[] = [];
  let i = 0;
  let keyIdx = 0;
  const nextKey = () => `md_${keyIdx++}`;

  while (i < lines.length) {
    const line = lines[i];

    // Skip empty lines between blocks
    if (line.trim() === '') {
      i++;
      continue;
    }

    // Code block ```
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim();
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      result.push(
        <pre key={nextKey()} style={styles.codeBlock}>
          <code style={styles.code}>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    // Table
    if (line.startsWith('|') && i + 1 < lines.length && lines[i + 1].match(/^\|[\s\-:|]+\|$/)) {
      const tableLines: string[] = [line];
      i++; // header separator
      tableLines.push(lines[i]);
      i++;
      while (i < lines.length && lines[i].startsWith('|')) {
        tableLines.push(lines[i]);
        i++;
      }
      result.push(renderTable(tableLines, nextKey()));
      continue;
    }

    // Horizontal rule
    if (line.match(/^---+$/)) {
      result.push(<hr key={nextKey()} style={styles.hr} />);
      i++;
      continue;
    }

    // Heading
    const hMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      const level = hMatch[1].length;
      const text = hMatch[2];
      const headingStyle = getHeadingStyle(level);
      const el = React.createElement(`h${level}`, { key: nextKey(), style: headingStyle }, renderInline(text));
      result.push(el);
      i++;
      continue;
    }

    // Blockquote
    if (line.startsWith('>')) {
      const quoteLines: string[] = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        quoteLines.push(lines[i].slice(1).trim());
        i++;
      }
      result.push(
        <blockquote key={nextKey()} style={styles.blockquote}>
          {renderInline(quoteLines.join('\n'))}
        </blockquote>
      );
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\.\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^\d+\.\s/)) {
        items.push(lines[i].replace(/^\d+\.\s/, ''));
        i++;
      }
      result.push(
        <ol key={nextKey()} style={styles.ol}>
          {items.map((item, idx) => <li key={idx} style={styles.li}>{renderInline(item)}</li>)}
        </ol>
      );
      continue;
    }

    // Unordered list
    if (line.match(/^[-*+]\s/)) {
      const items: string[] = [];
      while (i < lines.length && lines[i].match(/^[-*+]\s/)) {
        items.push(lines[i].replace(/^[-*+]\s/, ''));
        i++;
      }
      result.push(
        <ul key={nextKey()} style={styles.ul}>
          {items.map((item, idx) => <li key={idx} style={styles.li}>{renderInline(item)}</li>)}
        </ul>
      );
      continue;
    }

    // Paragraph
    const paraLines: string[] = [line];
      i++;
      while (i < lines.length && lines[i].trim() !== '' && !lines[i].startsWith('#') && !lines[i].startsWith('|') && !lines[i].startsWith('>') && !lines[i].match(/^[-*+\d]\s/)) {
        paraLines.push(lines[i]);
        i++;
      }
      result.push(<p key={nextKey()} style={styles.p}>{renderInline(paraLines.join(' '))}</p>);
  }

  return result;
}

// ─── Render table ─────────────────────────────────────────────────────────

function renderTable(lines: string[], key: string): React.ReactNode {
  const rows = lines.map(l =>
    l.split('|').map(c => c.trim()).filter(c => c !== '')
  );
  if (rows.length < 3) return null;

  const headers = rows[0];
  // Skip separator row (index 1)
  const dataRows = rows.slice(2);

  return (
    <div key={key} style={{ overflowX: 'auto', margin: '12px 0' }}>
      <table style={styles.table}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={styles.th}>{renderInline(h)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {dataRows.map((row, ri) => (
            <tr key={ri} style={ri % 2 === 1 ? styles.trAlt : undefined}>
              {row.map((cell, ci) => (
                <td key={ci} style={styles.td}>{renderInline(cell)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Inline rendering ───────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  // Bold **text**
  let result: React.ReactNode = text;

  // Split by patterns
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*\*(.+?)\*\*/g, render: (m: string) => <strong key={key++} style={styles.bold}>{m}</strong> },
    { regex: /\*(.+?)\*/g, render: (m: string) => <em key={key++} style={styles.italic}>{m}</em> },
    { regex: /`(.+?)`/g, render: (m: string) => <code key={key++} style={styles.inlineCode}>{m}</code> },
    { regex: /\[(.+?)\]\((.+?)\)/g, render: (label: string, url: string) => <a key={key++} href={url} style={styles.link} target="_blank" rel="noopener noreferrer">{label}</a> },
  ];

  // Simple approach: process in order
  const processPattern = (input: string, regex: RegExp, renderFn: (match: RegExpExecArray) => React.ReactNode): React.ReactNode[] => {
    const out: React.ReactNode[] = [];
    let lastIndex = 0;
    let m;
    regex.lastIndex = 0;
    while ((m = regex.exec(input)) !== null) {
      if (m.index > lastIndex) {
        out.push(input.slice(lastIndex, m.index));
      }
      out.push(renderFn(m));
      lastIndex = m.index + m[0].length;
    }
    if (lastIndex < input.length) {
      out.push(input.slice(lastIndex));
    }
    return out.length ? out : [input];
  };

  let nodes: React.ReactNode[] = [text];

  // Bold
  nodes = nodes.flatMap(n => {
    if (typeof n !== 'string') return [n];
    return processPattern(n, /\*\*(.+?)\*\*/g, m => <strong key={`b_${key++}`} style={styles.bold}>{m[1]}</strong>);
  });

  // Italic
  nodes = nodes.flatMap(n => {
    if (typeof n !== 'string') return [n];
    return processPattern(n, /\*(.+?)\*/g, m => <em key={`i_${key++}`} style={styles.italic}>{m[1]}</em>);
  });

  // Inline code
  nodes = nodes.flatMap(n => {
    if (typeof n !== 'string') return [n];
    return processPattern(n, /`(.+?)`/g, m => <code key={`c_${key++}`} style={styles.inlineCode}>{m[1]}</code>);
  });

  // Links
  nodes = nodes.flatMap(n => {
    if (typeof n !== 'string') return [n];
    return processPattern(n, /\[(.+?)\]\((.+?)\)/g, m => (
      <a key={`a_${key++}`} href={m[2]} style={styles.link} target="_blank" rel="noopener noreferrer">{m[1]}</a>
    ));
  });

  return <>{nodes}</>;
}

// ─── Styles ───────────────────────────────────────────────────────────────

function getHeadingStyle(level: number): React.CSSProperties {
  const base = { fontWeight: 700, color: 'var(--text-primary)' } as React.CSSProperties;
  switch (level) {
    case 1: return { ...base, fontSize: 20, margin: '20px 0 12px', color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: 6 };
    case 2: return { ...base, fontSize: 16, margin: '16px 0 10px' };
    case 3: return { ...base, fontSize: 14, margin: '12px 0 8px', color: 'var(--text-secondary)' };
    case 4: return { ...base, fontSize: 13, margin: '10px 0 6px', color: 'var(--text-secondary)' };
    case 5: return { ...base, fontSize: 12, margin: '8px 0 4px', color: 'var(--text-muted)' };
    case 6: return { ...base, fontSize: 11, margin: '6px 0 2px', color: 'var(--text-muted)' };
    default: return base;
  }
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    fontSize: 14,
    lineHeight: 1.65,
    color: 'var(--text-primary)',
  },
  p: {
    margin: '8px 0',
    wordBreak: 'break-word',
  },
  bold: { fontWeight: 700 },
  italic: { fontStyle: 'italic' },
  link: { color: 'var(--primary)', textDecoration: 'none' },
  inlineCode: {
    background: 'var(--gray-100)',
    padding: '1px 4px',
    borderRadius: 4,
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--danger)',
  },
  codeBlock: {
    background: '#1F2937',
    color: '#E5E7EB',
    padding: '12px 16px',
    borderRadius: 8,
    overflowX: 'auto',
    fontSize: 12,
    lineHeight: 1.5,
    fontFamily: 'monospace',
    margin: '12px 0',
  },
  code: { fontFamily: 'monospace', whiteSpace: 'pre' },
  blockquote: {
    borderLeft: '3px solid var(--primary)',
    padding: '8px 12px',
    margin: '12px 0',
    background: 'var(--gray-50)',
    borderRadius: '0 6px 6px 0',
    color: 'var(--text-secondary)',
    fontStyle: 'italic',
  },
  ul: { paddingLeft: 20, margin: '8px 0' },
  ol: { paddingLeft: 20, margin: '8px 0' },
  li: { margin: '4px 0' },
  hr: { border: 'none', borderTop: '1px solid var(--border)', margin: '16px 0' },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 12,
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    overflow: 'hidden',
  },
  th: {
    background: 'var(--gray-50)',
    padding: '8px 10px',
    textAlign: 'left',
    fontWeight: 700,
    fontSize: 11,
    borderBottom: '2px solid var(--border)',
    whiteSpace: 'nowrap',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  },
  td: {
    padding: '7px 10px',
    borderBottom: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    verticalAlign: 'top',
  },
  trAlt: { background: 'var(--bg-stripe)' },
} as any;
