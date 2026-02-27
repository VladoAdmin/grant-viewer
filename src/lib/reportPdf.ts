import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { GrantCall, GrantAttribute } from './supabase';

function pickAttr(attrs: GrantAttribute[], keys: string[]): string | null {
  for (const k of keys) {
    const kl = k.toLowerCase();
    const hit = attrs.find(a => {
      const ak = a.key.toLowerCase();
      return ak === kl || ak.includes(kl) || kl.includes(ak);
    });
    if (hit?.value) return hit.value;
  }
  return null;
}

function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return null as unknown as string;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(num) + ' EUR';
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d; // return raw string if unparseable
    return date.toLocaleDateString('sk-SK');
  } catch {
    return d;
  }
}

interface Section {
  label: string;
  value: string | null;
}

function buildSections(call: GrantCall, attrs: GrantAttribute[]): Section[] {
  // Build harmonogram
  const announcedRaw = call.announced_at || pickAttr(attrs, ['Dátum vyhlásenia']);
  const deadlineRaw = call.deadline_at || pickAttr(attrs, ['Dátum ukončenia', 'Dátum uzávierky']);
  const harmonogram = [
    announcedRaw ? `vyhlásenie výzvy: ${formatDate(announcedRaw) || announcedRaw}` : null,
    deadlineRaw ? `uzávierka výzvy: ${formatDate(deadlineRaw) || deadlineRaw}` : null,
  ].filter(Boolean).join('\n');

  // Build allocation
  const allocationVal = call.total_allocation
    ? formatMoney(call.total_allocation)
    : pickAttr(attrs, ['Celková alokácia', 'Alokácia', 'alokacia_eu', 'Alokácia EÚ']);

  // Financial params
  const maxGrant = pickAttr(attrs, ['Max. grant', 'Max. podpora na projekt', 'Max. podpora']);
  const minGrant = pickAttr(attrs, ['Min. podpora na projekt', 'Min. podpora']);
  const financialParams = [maxGrant, minGrant].filter(Boolean).join('\n') || null;

  return [
    { label: 'NÁZOV:', value: call.title },
    { label: 'KÓD VÝZVY:', value: pickAttr(attrs, ['Kód výzvy', 'Kód']) || call.call_type },
    { label: 'POSKYTOVATEĽ:', value: call.provider || pickAttr(attrs, ['Poskytovateľ', 'Vyhlasovateľ výzvy', 'vyhlasovatel_vyzvy', 'Vykonávatelia / rezorty', 'Vykonávatelia']) },
    { label: 'CIEĽ VÝZVY', value: pickAttr(attrs, ['Cieľ výzvy', 'Cieľ', 'Špecifický cieľ', 'Oblasť', 'Názov reformy']) },
    { label: 'ALOKÁCIA VÝZVY', value: allocationVal ? formatMoney(allocationVal) || allocationVal : null },
    { label: 'OPRÁVNENÉ ÚZEMIE', value: pickAttr(attrs, ['Miesto realizácie', 'Oprávnené územie']) },
    { label: 'FINANČNÉ PARAMETRE NA PROJEKT', value: financialParams },
    { label: 'SPOLUÚČASŤ ŽIADATEĽA', value: pickAttr(attrs, ['Miera spolufinancovania', 'Spoluúčasť']) },
    { label: 'ČASOVÝ HARMONOGRAM VÝZVY', value: harmonogram || null },
    { label: 'ČASOVÁ OPRÁVNENOSŤ REALIZÁCIE PROJEKTU', value: pickAttr(attrs, ['Časová oprávnenosť']) },
    { label: 'OPRÁVNENÝ ŽIADATEĽ', value: call.eligible_applicants || pickAttr(attrs, ['opravneni_ziadatelia', 'Oprávnení žiadatelia', 'Cieľová skupina']) },
    { label: 'OPRÁVNENÉ AKTIVITY', value: pickAttr(attrs, ['Oprávnené aktivity']) },
    { label: 'KRITÉRIÁ VÝBERU', value: pickAttr(attrs, ['Kritériá výberu']) },
    { label: 'PROGRAM', value: pickAttr(attrs, ['Program', 'Komponent']) },
    { label: 'ĎALŠIE INFORMÁCIE', value: pickAttr(attrs, ['Doplňujúce informácie', 'Ďalšie podmienky']) },
  ];
}

function createReportHtml(call: GrantCall, attrs: GrantAttribute[]): string {
  const sections = buildSections(call, attrs);
  const filledSections = sections.filter(s => s.value);

  const rows = filledSections.map(s => `
    <tr>
      <td class="label">${s.label}</td>
      <td class="value">${(s.value || '').replace(/\n/g, '<br>')}</td>
    </tr>
  `).join('');

  return `
    <div id="pdf-report" style="
      width: 595px;
      padding: 40px 48px;
      font-family: 'Segoe UI', Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    ">
      <h2 style="
        text-align: center;
        font-size: 13px;
        font-weight: bold;
        margin: 0 0 24px 0;
        letter-spacing: 0.5px;
        line-height: 1.4;
      ">
        MONITORING – FINANCOVANIE Z<br>
        PROSTRIEDKOV EÚ A ŠTÁTNEHO ROZPOČTU SR
      </h2>

      <table style="width: 100%; border-collapse: collapse;">
        ${rows}
      </table>

      <div style="
        margin-top: 40px;
        padding-top: 12px;
        border-top: 1px solid #ccc;
        font-size: 9px;
        color: #666;
        text-align: center;
      ">
        www.stormlevel.com
      </div>
    </div>

    <style>
      #pdf-report td {
        vertical-align: top;
        padding: 6px 4px;
        border-bottom: 1px solid #eee;
      }
      #pdf-report td.label {
        font-weight: bold;
        width: 220px;
        white-space: nowrap;
        font-size: 10px;
        text-transform: uppercase;
        color: #333;
      }
      #pdf-report td.value {
        font-size: 11px;
        word-break: break-word;
      }
    </style>
  `;
}

export async function generateCallMonitoringPdf(call: GrantCall, attrs: GrantAttribute[]): Promise<{ filename: string }> {
  // Create off-screen container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.zIndex = '-1';
  container.innerHTML = createReportHtml(call, attrs);
  document.body.appendChild(container);

  const reportEl = container.querySelector('#pdf-report') as HTMLElement;

  try {
    const canvas = await html2canvas(reportEl, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      logging: false,
    });

    const imgData = canvas.toDataURL('image/jpeg', 0.95);
    const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'JPEG', 0, 0, imgWidth, imgHeight);
    } else {
      // Multi-page
      let remainingHeight = canvas.height;
      let position = 0;
      const pageCanvasHeight = (pageHeight * canvas.width) / pageWidth;

      while (remainingHeight > 0) {
        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = Math.min(pageCanvasHeight, remainingHeight);
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, position, canvas.width, pageCanvas.height, 0, 0, canvas.width, pageCanvas.height);
        const pageData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const drawHeight = (pageCanvas.height * imgWidth) / canvas.width;

        if (position > 0) pdf.addPage();
        pdf.addImage(pageData, 'JPEG', 0, 0, imgWidth, drawHeight);

        remainingHeight -= pageCanvasHeight;
        position += pageCanvasHeight;
      }
    }

    const safeName = (call.title || 'vyzva')
      .replace(/[^a-zA-Z0-9áäčďéíĺľňóôŕšťúýžÁÄČĎÉÍĹĽŇÓÔŔŠŤÚÝŽ\s_-]/g, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 80);

    const filename = `Monitoring_${safeName || call.id}.pdf`;
    pdf.save(filename);
    return { filename };
  } finally {
    document.body.removeChild(container);
  }
}
