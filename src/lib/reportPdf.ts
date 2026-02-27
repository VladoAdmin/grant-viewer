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

function formatMoney(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  const num = typeof value === 'number' ? value : parseFloat(String(value).replace(/[^\d.-]/g, ''));
  if (isNaN(num)) return String(value);
  return new Intl.NumberFormat('sk-SK', { maximumFractionDigits: 0 }).format(num) + ' EUR';
}

function formatDate(d: string | null | undefined): string | null {
  if (!d) return null;
  try {
    const date = new Date(d);
    if (isNaN(date.getTime())) return d;
    return date.toLocaleDateString('sk-SK');
  } catch {
    return d;
  }
}

interface Section {
  label: string;
  value: string;
}

function buildSections(call: GrantCall, attrs: GrantAttribute[]): Section[] {
  const sections: Section[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value && value.trim()) sections.push({ label, value: value.trim() });
  };

  // VÝZVA
  add('VÝZVA:', call.title);

  // POSKYTOVATEĽ
  add('POSKYTOVATEĽ:', call.provider
    || pickAttr(attrs, ['Poskytovateľ', 'Vyhlasovateľ výzvy', 'vyhlasovatel_vyzvy', 'Vykonávatelia / rezorty', 'Vykonávatelia']));

  // CIEĽ VÝZVY
  add('CIEĽ VÝZVY', pickAttr(attrs, ['Cieľ výzvy', 'Cieľ', 'Špecifický cieľ'])
    || pickAttr(attrs, ['Oblasť', 'Názov reformy']));

  // HARMONOGRAM - 3 riadky
  const announced = call.announced_at || pickAttr(attrs, ['Dátum vyhlásenia']);
  const deadline = call.deadline_at || pickAttr(attrs, ['Dátum ukončenia', 'Dátum uzávierky']);
  const predkladanie = pickAttr(attrs, ['Predkladanie', 'Miesto pre podanie ŽoNFP']);
  
  const harmonogramParts: string[] = [];
  if (announced) harmonogramParts.push('Vyhlásenie výzvy: ' + (formatDate(announced) || announced));
  if (predkladanie) harmonogramParts.push('Predkladanie: ' + predkladanie);
  if (deadline) harmonogramParts.push('Uzatvorenie výzvy: ' + (formatDate(deadline) || deadline));
  if (harmonogramParts.length > 0) {
    add('HARMONOGRAM VÝZVY', harmonogramParts.join('\n'));
  }

  // ALOKÁCIA VÝZVY
  const alloc = call.total_allocation
    ? formatMoney(call.total_allocation)
    : (pickAttr(attrs, ['Celková alokácia', 'Alokácia', 'alokacia_eu', 'Alokácia EÚ']));
  add('ALOKÁCIA VÝZVY', alloc);

  // PROJEKT (finančné parametre)
  const maxGrant = pickAttr(attrs, ['Max. grant', 'Max. podpora na projekt', 'Max. podpora']);
  const minGrant = pickAttr(attrs, ['Min. podpora na projekt', 'Min. podpora']);
  const projectParts: string[] = [];
  if (maxGrant) projectParts.push('maximálna výška na 1 projekt: ' + maxGrant);
  if (minGrant) projectParts.push('minimálna výška na 1 projekt: ' + minGrant);
  if (projectParts.length > 0) add('PROJEKT', projectParts.join('\n'));

  // OPRÁVNENÉ ÚZEMIE
  add('OPRÁVNENÉ ÚZEMIE', pickAttr(attrs, ['Miesto realizácie', 'Oprávnené územie']));

  // SPOLUÚČASŤ
  add('SPOLUÚČASŤ', pickAttr(attrs, ['Miera spolufinancovania', 'Spoluúčasť']));

  // OPRÁVNENÝ ŽIADATEĽ
  add('OPRÁVNENÝ ŽIADATEĽ', call.eligible_applicants
    || pickAttr(attrs, ['opravneni_ziadatelia', 'Oprávnení žiadatelia', 'Cieľová skupina 1']));

  // OPRÁVNENÉ AKTIVITY
  add('OPRÁVNENÉ AKTIVITY', pickAttr(attrs, ['Oprávnené aktivity']));

  // KRITÉRIÁ VÝBERU
  add('KRITÉRIÁ VÝBERU', pickAttr(attrs, ['Kritériá výberu']));

  // PROGRAM / KOMPONENT
  add('PROGRAM', pickAttr(attrs, ['Program', 'Komponent']));

  // ĎALŠIE PODMIENKY
  add('ĎALŠIE PODMIENKY', pickAttr(attrs, ['Ďalšie podmienky', 'Doplňujúce informácie']));

  // KÓD VÝZVY
  add('KÓD VÝZVY', pickAttr(attrs, ['Kód výzvy', 'Kód']));

  return sections;
}

function createReportHtml(call: GrantCall, attrs: GrantAttribute[]): string {
  const sections = buildSections(call, attrs);

  const rows = sections.map(s => `
    <tr>
      <td class="label">${s.label}</td>
      <td class="value">${s.value.replace(/\n/g, '<br>').replace(/·/g, '&bull;')}</td>
    </tr>
  `).join('');

  return `
    <div id="pdf-report" style="
      width: 595px;
      padding: 36px 44px;
      font-family: 'Segoe UI', Arial, sans-serif;
      font-size: 11px;
      line-height: 1.5;
      color: #1a1a1a;
      background: white;
    ">
      <table style="width: 100%; border-collapse: collapse; border: 1px solid #999;">
        <tbody>
          ${rows}
        </tbody>
      </table>

      <div style="
        margin-top: 32px;
        font-size: 9px;
        color: #888;
        text-align: center;
      ">
        www.stormlevel.com
      </div>
    </div>

    <style>
      #pdf-report td {
        vertical-align: top;
        padding: 8px 10px;
        border: 1px solid #bbb;
      }
      #pdf-report td.label {
        font-weight: bold;
        width: 180px;
        font-size: 10px;
        background: #f5f5f5;
        color: #222;
      }
      #pdf-report td.value {
        font-size: 11px;
        word-break: break-word;
      }
    </style>
  `;
}

export async function generateCallMonitoringPdf(call: GrantCall, attrs: GrantAttribute[]): Promise<{ filename: string }> {
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
