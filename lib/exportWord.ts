'use client';
/**
 * exportWord.ts — Export rapport SIGEP-DPE en .docx réel (package docx v9)
 */

import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell,
  WidthType, BorderStyle, AlignmentType, ShadingType, PageBreak,
  Header, Footer, PageNumber, convertInchesToTwip,
} from 'docx';

export interface SectionDocx {
  titre: string;
  contenu: string;   // texte plein (retours à la ligne = \n)
  tableau?: { headers: string[]; rows: string[][] };
}

export interface MetaRapport {
  titre: string;
  soustitre?: string;
  auteur: string;
  date: string;
  projet?: string;
  version?: string;
  confidentiel?: boolean;
}

function mkPar(text: string, opts: {
  bold?: boolean; color?: string; size?: number; heading?: typeof HeadingLevel[keyof typeof HeadingLevel]; spacing?: number; center?: boolean;
} = {}): Paragraph {
  return new Paragraph({
    heading: opts.heading,
    alignment: opts.center ? AlignmentType.CENTER : AlignmentType.JUSTIFIED,
    spacing: { before: opts.spacing ?? 100, after: opts.spacing ?? 100 },
    children: [
      new TextRun({
        text,
        bold: opts.bold,
        color: opts.color?.replace('#', ''),
        size: (opts.size ?? 11) * 2,
        font: 'Calibri',
      }),
    ],
  });
}

function mkTable(headers: string[], rows: string[][]): Table {
  const NAVY = '3D1A6B';
  const mkCell = (text: string, isHeader = false) =>
    new TableCell({
      shading: isHeader ? { type: ShadingType.SOLID, color: NAVY, fill: NAVY } : undefined,
      width: { size: Math.floor(9000 / headers.length), type: WidthType.DXA },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        bottom: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        left: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
        right: { style: BorderStyle.SINGLE, size: 4, color: 'E2E8F0' },
      },
      children: [new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text, bold: isHeader, color: isHeader ? 'FFFFFF' : '0F172A', size: 18, font: 'Calibri' })],
      })],
    });

  return new Table({
    width: { size: 9000, type: WidthType.DXA },
    rows: [
      new TableRow({ tableHeader: true, children: headers.map(h => mkCell(h, true)) }),
      ...rows.map(row => new TableRow({ children: row.map(cell => mkCell(cell)) })),
    ],
  });
}

export async function exportRapportWord(sections: SectionDocx[], meta: MetaRapport): Promise<void> {
  const NAVY = '3D1A6B';
  const children: Paragraph[] = [];

  // ── Page de titre ──────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ children: [new TextRun({ text: '', break: 3 })] }),
    mkPar('SENELEC — Direction Parc & Équipements', { bold: true, color: '#3D1A6B', size: 14, center: true }),
    new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }),
    mkPar(meta.titre, { heading: HeadingLevel.HEADING_1, bold: true, size: 18, center: true }),
    meta.soustitre ? mkPar(meta.soustitre, { size: 12, center: true, color: '#64748B' }) : new Paragraph({}),
    new Paragraph({ children: [new TextRun({ text: '', break: 2 })] }),
    mkPar(`Auteur : ${meta.auteur}`, { size: 11, center: true }),
    mkPar(`Date : ${meta.date}`, { size: 11, center: true }),
    meta.projet ? mkPar(`Projet : ${meta.projet}`, { size: 11, center: true }) : new Paragraph({}),
    mkPar(`Version : ${meta.version ?? '1.0'}`, { size: 11, center: true }),
    meta.confidentiel !== false
      ? mkPar('DOCUMENT CONFIDENTIEL — Usage interne SENELEC/DPE', { bold: true, color: '#EF3340', size: 10, center: true })
      : new Paragraph({}),
    new Paragraph({ children: [new PageBreak()] }),
  );

  // ── Sommaire manuel ────────────────────────────────────────────────────────
  children.push(
    mkPar('SOMMAIRE', { heading: HeadingLevel.HEADING_2, bold: true, color: '#3D1A6B' }),
  );
  sections.forEach((sec, i) => {
    children.push(mkPar(`${i + 1}. ${sec.titre}`, { size: 11 }));
  });
  children.push(new Paragraph({ children: [new PageBreak()] }));

  // ── Sections ───────────────────────────────────────────────────────────────
  for (const sec of sections) {
    children.push(
      mkPar(sec.titre, { heading: HeadingLevel.HEADING_2, bold: true, color: '#3D1A6B', spacing: 200 }),
    );

    // Paragraphes (séparés par \n)
    const paragraphes = sec.contenu.split('\n').filter(l => l.trim());
    for (const p of paragraphes) {
      if (p.startsWith('1.') || p.startsWith('2.') || p.startsWith('3.') || p.startsWith('4.') || p.startsWith('5.')) {
        children.push(mkPar(p, { bold: true, size: 11, spacing: 120 }));
      } else if (p.startsWith('   •') || p.startsWith('• ')) {
        children.push(mkPar(`  ${p.replace(/^\s*•\s*/, '• ')}`, { size: 10.5, spacing: 80 }));
      } else {
        children.push(mkPar(p, { size: 11, spacing: 100 }));
      }
    }

    // Tableau optionnel
    if (sec.tableau && sec.tableau.headers.length > 0) {
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      // @ts-expect-error docx types
      children.push(mkTable(sec.tableau.headers, sec.tableau.rows));
      children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
    }

    children.push(new Paragraph({ children: [new TextRun({ text: '', break: 1 })] }));
  }

  // ── Build document ─────────────────────────────────────────────────────────
  const doc = new Document({
    creator: meta.auteur,
    title: meta.titre,
    description: meta.soustitre ?? '',
    styles: {
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Calibri', size: 22 },
          paragraph: { spacing: { line: 276 } },
        },
      ],
    },
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.2),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              children: [
                new TextRun({ text: `SENELEC DPE — ${meta.titre}`, size: 16, color: NAVY, font: 'Calibri' }),
              ],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({ text: `${meta.confidentiel !== false ? 'CONFIDENTIEL — ' : ''}SIGEP-DPE · Page `, size: 16, color: '94A3B8', font: 'Calibri' }),
                new TextRun({ children: [PageNumber.CURRENT], size: 16, color: '94A3B8', font: 'Calibri' }),
              ],
            }),
          ],
        }),
      },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${meta.titre.replace(/[^a-zA-Z0-9À-ž\s]/g, '').replace(/\s+/g, '_')}_${meta.date}.docx`;
  a.click();
  URL.revokeObjectURL(url);
}
