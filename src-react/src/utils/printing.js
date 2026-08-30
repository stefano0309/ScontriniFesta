// printing.js — doppio binario di stampa: RawBT (ESC/POS via intent Android)
// oppure finestra di stampa di sistema (HTML + window.print()).
// Porting 1:1 della logica originale.

import { escapeHtml, formatTicketNum } from './format';

export const ESC = '\x1B';
export const GS = '\x1D';
export const P_LINE = '-'.repeat(32);

const ACCENT_MAP = {
  'à':'a','á':'a','â':'a','ä':'a','è':'e','é':'e','ê':'e','ë':'e',
  'ì':'i','í':'i','î':'i','ï':'i','ò':'o','ó':'o','ô':'o','ö':'o',
  'ù':'u','ú':'u','û':'u','ü':'u','ç':'c','ñ':'n',
  'À':'A','Á':'A','È':'E','É':'E','Ì':'I','Ò':'O','Ù':'U','€':'EUR',
};

// Scarta gli accenti (le stampanti termiche ESC/POS a 1 byte spesso non li
// supportano) e qualunque carattere non rappresentabile su una riga.
export function textForPrinter(s) {
  let out = String(s).replace(/[àáâäèéêëìíîïòóôöùúûüçñÀÁÈÉÌÒÙ€]/g, (ch) => ACCENT_MAP[ch] || ch);
  out = out.split('').map((ch) => (ch.charCodeAt(0) > 255 ? '?' : ch)).join('');
  return out;
}

// Avanzamento carta + taglio. La lama del taglierino sta più in basso della
// testina: poca carta prima del taglio = taglio a metà riga. Il numero di
// righe necessario è regolabile dalle Impostazioni (settings.rawbtCutFeedLines).
export function cutFeedAndCut(settings) {
  let out = '';
  if (settings.rawbtCut) {
    const feedLines = Math.max(3, parseInt(settings.rawbtCutFeedLines, 10) || 5);
    out += '\n'.repeat(feedLines);
    out += GS + 'V' + '\x01';
  } else {
    out += '\n\n\n';
  }
  return out;
}

export function buildKitchenEscPos(ticket, orderNum, now, tag, settings) {
  let out = '';
  if (ticket.spacer3cm) out += '\n'.repeat(8); // circa 3 cm su una termica standard
  out += ESC + 'a' + '\x01';
  out += GS + '!' + '\x11';
  out += textForPrinter('#' + formatTicketNum(orderNum, tag)) + '\n';
  out += GS + '!' + '\x00';
  out += textForPrinter(now.toLocaleDateString('it-IT') + ' · ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) + '\n';
  out += P_LINE + '\n';
  out += GS + '!' + '\x11';
  out += textForPrinter(ticket.qty + 'x ' + ticket.name) + '\n';
  out += GS + '!' + '\x00';
  if (ticket.note) out += textForPrinter('- ' + ticket.note) + '\n';
  out += ESC + 'a' + '\x00';
  out += cutFeedAndCut(settings);
  return out;
}

export function buildSummaryEscPos(lines, orderNum, now, tag, settings) {
  let out = '';
  out += ESC + 'a' + '\x01';
  out += ESC + 'E' + '\x01' + textForPrinter(settings.bizName) + '\n' + ESC + 'E' + '\x00';
  out += 'SCONTRINO RIEPILOGATIVO\n';
  out += GS + '!' + '\x11';
  out += textForPrinter('#' + formatTicketNum(orderNum, tag)) + '\n';
  out += GS + '!' + '\x00';
  out += textForPrinter(now.toLocaleDateString('it-IT') + ' · ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) + '\n';
  out += P_LINE + '\n';
  out += ESC + 'a' + '\x00';
  lines.forEach((l) => {
    const left = textForPrinter(l.qty + 'x ' + l.name);
    const right = settings.currency.length <= 1
      ? (textForPrinter(settings.currency) + (l.price * l.qty).toFixed(2))
      : ((l.price * l.qty).toFixed(2) + textForPrinter(settings.currency));
    const pad = Math.max(1, 32 - left.length - right.length);
    out += left + ' '.repeat(pad) + right + '\n';
    if (l.note) out += '  - ' + textForPrinter(l.note) + '\n';
  });
  out += P_LINE + '\n';
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  out += ESC + 'E' + '\x01' + 'TOTALE'.padEnd(20) + textForPrinter(settings.currency) + ' ' + total.toFixed(2) + ESC + 'E' + '\x00' + '\n';
  out += ESC + 'a' + '\x01';
  if (settings.vat) out += textForPrinter(settings.vat) + '\n';
  out += textForPrinter(settings.footer) + '\n';
  out += ESC + 'a' + '\x00';
  out += cutFeedAndCut(settings);
  return out;
}

export function buildCloseSummaryEscPos({ totals, grandTotal, orders, cashFloat, cashAdditions, additionsTotal, settings }) {
  const expectedTotal = grandTotal + Number(cashFloat.amount || 0) + additionsTotal;
  const now = new Date();
  let out = '';
  out += ESC + 'a' + '\x01';
  out += ESC + 'E' + '\x01' + textForPrinter(settings.bizName) + '\n' + ESC + 'E' + '\x00';
  out += 'CHIUSURA CASSA\n';
  out += textForPrinter(now.toLocaleDateString('it-IT') + ' ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) + '\n';
  out += P_LINE + '\n';
  out += ESC + 'a' + '\x00';
  out += textForPrinter(orders + ' ordini') + '\n';
  Object.keys(totals).sort().forEach((name) => {
    const t = totals[name];
    const left = textForPrinter(name + ' x' + t.qty);
    const right = textForPrinter(settings.currency) + ' ' + t.revenue.toFixed(2);
    const pad = Math.max(1, 32 - left.length - right.length);
    out += left + ' '.repeat(pad) + right + '\n';
  });
  out += P_LINE + '\n';
  out += ESC + 'E' + '\x01' + 'INCASSO'.padEnd(20) + textForPrinter(settings.currency) + ' ' + grandTotal.toFixed(2) + ESC + 'E' + '\x00' + '\n';
  if (cashFloat.setAt) {
    out += P_LINE + '\n';
    out += textForPrinter('FONDO CASSA INIZIALE') + '\n';
    out += textForPrinter(cashFloat.note || 'Importo iniziale') + '\n';
    out += textForPrinter('Fondo cassa'.padEnd(20) + textForPrinter(settings.currency) + ' ' + Number(cashFloat.amount || 0).toFixed(2)) + '\n';
  }
  if (cashAdditions.length) {
    out += P_LINE + '\n';
    out += textForPrinter('CONTANTE AGGIUNTO IN SERATA') + '\n';
    cashAdditions.forEach((a) => {
      const when = new Date(a.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      const left = textForPrinter(when + (a.deviceTag ? ' ' + a.deviceTag : ''));
      const right = textForPrinter(settings.currency) + ' ' + Number(a.amount || 0).toFixed(2);
      const pad = Math.max(1, 32 - left.length - right.length);
      out += left + ' '.repeat(pad) + right + '\n';
      if (a.note) out += '  ' + textForPrinter(a.note) + '\n';
    });
    out += textForPrinter('Totale aggiunte'.padEnd(20) + textForPrinter(settings.currency) + ' ' + additionsTotal.toFixed(2)) + '\n';
  }
  if (cashFloat.setAt || cashAdditions.length) {
    out += P_LINE + '\n';
    out += ESC + 'E' + '\x01' + 'TOTALE CASSA'.padEnd(20) + textForPrinter(settings.currency) + ' ' + expectedTotal.toFixed(2) + ESC + 'E' + '\x00' + '\n';
  }
  out += cutFeedAndCut(settings);
  return out;
}

// ---------- RawBT (invio diretto Bluetooth via intent Android) ----------
export function sendViaRawBt(payload) {
  const b64 = btoa(payload);
  window.location.href = 'rawbt:base64,' + b64;
}

// Il lato Android intercetta lo schema "rawbt:" e prova ad aprire l'app RawBT.
// Se RawBT non è installata, chiama window.__rawbtResult(false, msg): in tal
// caso NON dobbiamo considerare l'ordine come stampato, altrimenti si perde
// l'ordine dalla cassa senza che nulla sia stato realmente stampato.
export function sendViaRawBtAndWait(payload, timeoutMs = 800) {
  return new Promise((resolve) => {
    let settled = false;
    window.__rawbtResult = (ok, message) => {
      if (settled) return;
      settled = true;
      resolve({ ok, message });
    };
    sendViaRawBt(payload);
    setTimeout(() => {
      if (settled) return;
      settled = true;
      resolve({ ok: true });
    }, timeoutMs);
  });
}

// ---------- Finestra di stampa di sistema (HTML) ----------
export function ensurePrintPageStyle(settings) {
  let styleEl = document.getElementById('dynamicPrintStyle');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'dynamicPrintStyle';
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `
    .print-page{ width: ${settings.paperWidth}mm; }
    @page{ size: ${settings.paperWidth}mm auto; margin: 3mm; }
  `;
}

export function renderKitchenPage(ticket, orderNum, now, tag, settings) {
  const priceLine = (settings.showPricesKitchen && !ticket.noPrice)
    ? `<div class="line"><span>${ticket.qty}x ${escapeHtml(ticket.name)}</span><span>${settings.currency} ${(ticket.price * ticket.qty).toFixed(2)}</span></div>`
    : '';
  return `
  <div class="print-page${ticket.spacer3cm ? ' spacer-top' : ''}">
    <div class="p-head">
      <div class="ticket-number">#${formatTicketNum(orderNum, tag)}</div>
      <div class="meta">${now.toLocaleDateString('it-IT')} · ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <hr>
    ${priceLine}
    <div class="p-item">${ticket.qty}x ${escapeHtml(ticket.name)}</div>
    ${ticket.note ? `<div class="p-note">— ${escapeHtml(ticket.note)}</div>` : ''}
  </div>`;
}

export function renderSummaryPage(lines, orderNum, now, tag, settings) {
  const linesHtml = lines.map((l) => `
    <div class="line">
      <span>${l.qty}x ${escapeHtml(l.name)}</span>
      <span>${settings.currency} ${(l.price * l.qty).toFixed(2)}</span>
    </div>
    ${l.note ? `<div class="l-note">— ${escapeHtml(l.note)}</div>` : ''}
  `).join('');
  const total = lines.reduce((s, l) => s + l.price * l.qty, 0);
  return `
  <div class="print-page">
    <div class="p-head">
      <div class="biz">${escapeHtml(settings.bizName)}</div>
      <div class="kind">Scontrino riepilogativo</div>
      <div class="ticket-number">#${formatTicketNum(orderNum, tag)}</div>
      <div class="meta">${now.toLocaleDateString('it-IT')} · ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <hr>
    ${linesHtml}
    <hr>
    <div class="total"><span>Totale</span><span>${settings.currency} ${total.toFixed(2)}</span></div>
    ${settings.vat ? `<div class="foot">${escapeHtml(settings.vat)}</div>` : ''}
    <div class="foot">${escapeHtml(settings.footer)}</div>
  </div>`;
}

export function buildCloseSummaryHtmlPage({ totals, grandTotal, orders, cashFloat, cashAdditions, additionsTotal, settings }) {
  const expectedTotal = grandTotal + Number(cashFloat.amount || 0) + additionsTotal;
  const now = new Date();
  const rowsHtml = Object.keys(totals).sort().map((name) => {
    const t = totals[name];
    return `<div class="line"><span>${escapeHtml(name)} x${t.qty}</span><span>${settings.currency} ${t.revenue.toFixed(2)}</span></div>`;
  }).join('');
  const additionsHtml = cashAdditions.length ? `
    <hr>
    <div class="p-note" style="margin-bottom:6px;"><b>Contante aggiunto durante la serata</b></div>
    ${cashAdditions.map((a) => {
      const when = new Date(a.ts).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
      return `<div class="line"><span>${when}${a.deviceTag ? ' · ' + escapeHtml(a.deviceTag) : ''}${a.note ? ' — ' + escapeHtml(a.note) : ''}</span><span>${settings.currency} ${Number(a.amount || 0).toFixed(2)}</span></div>`;
    }).join('')}
    <div class="line"><span><b>Totale aggiunte</b></span><span><b>${settings.currency} ${additionsTotal.toFixed(2)}</b></span></div>` : '';
  return `
  <div class="print-page">
    <div class="p-head">
      <div class="biz">${escapeHtml(settings.bizName)}</div>
      <div class="kind">Chiusura cassa</div>
      <div class="meta">${now.toLocaleDateString('it-IT')} ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <hr>
    <div class="p-note" style="margin-bottom:6px;">${orders} ordini</div>
    ${rowsHtml}
    <hr>
    <div class="total"><span>Incasso vendite</span><span>${settings.currency} ${grandTotal.toFixed(2)}</span></div>
    ${cashFloat.setAt ? `<hr><div class="p-note" style="margin-bottom:6px;"><b>Fondo cassa iniziale</b></div><div class="line"><span>${cashFloat.note ? escapeHtml(cashFloat.note) : 'Importo iniziale'}</span><span>${settings.currency} ${Number(cashFloat.amount || 0).toFixed(2)}</span></div>` : ''}
    ${additionsHtml}
    ${(cashFloat.setAt || cashAdditions.length) ? `<div class="total"><span>Totale atteso in cassa</span><span>${settings.currency} ${expectedTotal.toFixed(2)}</span></div>` : ''}
  </div>`;
}

// Scrive le pagine nel div #printArea (deve esistere nel DOM, vedi App.jsx)
// e lancia la finestra di stampa di sistema.
export function printHtmlPages(pagesHtml, settings) {
  ensurePrintPageStyle(settings);
  const area = document.getElementById('printArea');
  if (area) area.innerHTML = pagesHtml;
  window.print();
}