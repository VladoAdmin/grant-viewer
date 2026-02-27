import { jsPDF } from 'jspdf';
import type { GrantCall, GrantAttribute } from './supabase';

function pickAttr(attrs: GrantAttribute[], keys: string[]): string | null {
  for (const k of keys) {
    const hit = attrs.find(a => a.key.toLowerCase() === k.toLowerCase() || a.key.toLowerCase().includes(k.toLowerCase()));
    if (hit?.value) return hit.value;
  }
  return null;
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'number') {
    return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(value) + ' EUR';
  }
  return value;
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize((text || '').trim(), maxWidth) as string[];
}

export function generateCallMonitoringPdf(call: GrantCall, attrs: GrantAttribute[]) {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 48;
  const maxTextWidth = pageWidth - margin * 2;

  let y = 56;

  // Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('MONITORING – FINANCOVANIE Z', margin, y);
  y += 16;
  doc.text('PROSTRIEDKOV EÚ A ŠTÁTNEHO ROZPOČTU SR', margin, y);
  y += 26;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');

  const sections: Array<{ label: string; value: string | null }>= [
    { label: 'NÁZOV:', value: call.title },
    { label: 'KÓD VÝZVY:', value: pickAttr(attrs, ['Kód výzvy', 'Kód']) },
    { label: 'POSKYTOVATEĽ:', value: call.provider || pickAttr(attrs, ['Poskytovateľ', 'Vyhlasovateľ výzvy']) },
    { label: 'CIEĽ VÝZVY', value: pickAttr(attrs, ['Cieľ výzvy', 'Cieľ']) },
    { label: 'ALOKÁCIA VÝZVY', value: formatMoney(call.total_allocation) },
    { label: 'OPRÁVNENÉ ÚZEMIE', value: pickAttr(attrs, ['Miesto realizácie', 'Oprávnené územie']) },
    { label: 'FINANČNÉ PARAMETRE NA PROJEKT', value: pickAttr(attrs, ['Max. grant', 'Min. podpora na projekt', 'Max. podpora na projekt', 'Max. podpora', 'Min. podpora']) },
    { label: 'SPOLUÚČASŤ ŽIADATEĽA', value: pickAttr(attrs, ['Miera spolufinancovania', 'Spoluúčasť']) },
    { label: 'ČASOVÝ HARMONOGRAM VÝZVY', value: [
        call.announced_at ? `vyhlásenie výzvy: ${new Date(call.announced_at).toLocaleDateString('sk-SK')}` : null,
        call.deadline_at ? `uzávierka výzvy: ${new Date(call.deadline_at).toLocaleDateString('sk-SK')}` : null,
      ].filter(Boolean).join('\n') || null },
    { label: 'ČASOVÁ OPRÁVNENOSŤ REALIZÁCIE PROJEKTU', value: pickAttr(attrs, ['Časová oprávnenosť', 'Realizácie projektu']) },
    { label: 'OPRÁVNENÝ ŽIADATEĽ', value: call.eligible_applicants || pickAttr(attrs, ['opravneni_ziadatelia', 'Oprávnení žiadatelia']) },
    { label: 'OPRÁVNENÉ AKTIVITY', value: pickAttr(attrs, ['Oprávnené aktivity']) },
    { label: 'KRITÉRIÁ VÝBERU', value: pickAttr(attrs, ['Kritériá výberu']) },
  ];

  const labelSize = 10;
  const valueSize = 10;

  for (const sec of sections) {
    if (!sec.value) continue;

    // Section label
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(labelSize);
    const labelLines = splitLines(doc, sec.label, maxTextWidth);
    doc.text(labelLines, margin, y);
    y += labelLines.length * 14;

    // Section value
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(valueSize);
    const valueLines = splitLines(doc, sec.value, maxTextWidth);
    doc.text(valueLines, margin, y);
    y += valueLines.length * 14 + 10;

    if (y > doc.internal.pageSize.getHeight() - 80) {
      doc.addPage();
      y = 56;
    }
  }

  // Footer
  const footer = 'www.stormlevel.com';
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(footer, margin, doc.internal.pageSize.getHeight() - 36);

  const safeName = (call.title || 'vyzva').replace(/[^a-z0-9áäčďéíĺľňóôŕšťúýž\s_-]/gi, '').slice(0, 80).trim().replace(/\s+/g, '_');
  return { doc, filename: `Monitoring_${safeName || call.id}.pdf` };
}
