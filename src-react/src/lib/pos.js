const ESC = '\x1B';
const GS = '\x1D';
const P_LINE = '-'.repeat(32);

const ACCENT_MAP = {
  'à': 'a', 'á': 'a', 'â': 'a', 'ä': 'a', 'è': 'e', 'é': 'e', 'ê': 'e', 'ë': 'e',
  'ì': 'i', 'í': 'i', 'î': 'i', 'ï': 'i', 'ò': 'o', 'ó': 'o', 'ô': 'o', 'ö': 'o',
  'ù': 'u', 'ú': 'u', 'û': 'u', 'ü': 'u', 'ç': 'c', 'ñ': 'n',
  'À': 'A', 'Á': 'A', 'È': 'E', 'É': 'E', 'Ì': 'I', 'Ò': 'O', 'Ù': 'U', '€': 'EUR',
};

export function formatTicketNum(orderNum, tag = 'A1') {
  return `${String(tag || 'A1').toUpperCase()}-${String(orderNum || 0).padStart(4, '0')}`;
}

export function textForPrinter(value) {
  const stringValue = String(value ?? '');
  let out = stringValue.replace(/[àáâäèéêëìíîïòóôöùúûüçñÀÁÈÉÌÒÙ€]/g, (ch) => ACCENT_MAP[ch] || ch);
  out = out.split('').map((char) => (char.charCodeAt(0) > 255 ? '?' : char)).join('');
  return out;
}

export function cutFeedAndCut(settings = {}) {
  if (settings.rawbtCut) {
    const feedLines = Math.max(3, Number(settings.rawbtCutFeedLines) || 5);
    return '\n'.repeat(feedLines) + GS + 'V' + '\x01';
  }
  return '\n\n\n';
}

export function buildKitchenEscPos(ticket, orderNum, now, tag = 'A1', settings = {}) {
  let out = '';
  if (ticket.spacer3cm) out += '\n'.repeat(8);
  out += ESC + 'a' + '\x01';
  out += GS + '!' + '\x11';
  out += textForPrinter('#' + formatTicketNum(orderNum, tag)) + '\n';
  out += GS + '!' + '\x00';
  out += textForPrinter(now.toLocaleDateString('it-IT') + ' · ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) + '\n';
  out += P_LINE + '\n';
  out += GS + '!' + '\x11';
  out += textForPrinter(`${ticket.qty}x ${ticket.name}`) + '\n';
  out += GS + '!' + '\x00';
  if (ticket.note) out += textForPrinter('- ' + ticket.note) + '\n';
  out += ESC + 'a' + '\x00';
  out += cutFeedAndCut(settings);
  return out;
}

export function buildSummaryEscPos(lines, orderNum, now, tag = 'A1', settings = {}) {
  let out = '';
  out += ESC + 'a' + '\x01';
  out += ESC + 'E' + '\x01' + textForPrinter(settings.bizName || 'La Mia Attività') + '\n' + ESC + 'E' + '\x00';
  out += 'SCONTRINO RIEPILOGATIVO\n';
  out += GS + '!' + '\x11';
  out += textForPrinter('#' + formatTicketNum(orderNum, tag)) + '\n';
  out += GS + '!' + '\x00';
  out += textForPrinter(now.toLocaleDateString('it-IT') + ' · ' + now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })) + '\n';
  out += P_LINE + '\n';
  out += ESC + 'a' + '\x00';

  lines.forEach((line) => {
    const left = textForPrinter(`${line.qty}x ${line.name}`);
    const right = `${settings.currency || '€'} ${(Number(line.price || 0) * Number(line.qty || 0)).toFixed(2)}`;
    const pad = Math.max(1, 32 - left.length - right.length);
    out += left + ' '.repeat(pad) + right + '\n';
    if (line.note) out += '  - ' + textForPrinter(line.note) + '\n';
  });

  out += P_LINE + '\n';
  const total = lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0);
  out += ESC + 'E' + '\x01' + 'TOTALE'.padEnd(20) + (settings.currency || '€') + ' ' + total.toFixed(2) + ESC + 'E' + '\x00' + '\n';
  out += ESC + 'a' + '\x01';
  if (settings.vat) out += textForPrinter(settings.vat) + '\n';
  out += textForPrinter(settings.footer || 'Grazie e arrivederci') + '\n';
  out += ESC + 'a' + '\x00';
  out += cutFeedAndCut(settings);
  return out;
}

export function dishCategory(dish, menu = []) {
  const match = menu.find((item) => item.id === dish.dishId || item.name === dish.name);
  if (!match) return 'Senza categoria';
  return match.category?.trim() || 'Senza categoria';
}

export function isCategoryCumulative(category, settings = {}) {
  return settings.categoryCumulative?.[category] !== false;
}

export function isCategoryPrintable(category, settings = {}) {
  return settings.categoryPrintTicket?.[category] !== false;
}

export function isCategorySpacer3cm(category, settings = {}) {
  return settings.categorySpacer3cm?.[category] === true;
}

export function getKitchenTicketsForLines(lines, menu = [], settings = {}) {
  const tickets = [];
  (lines || []).forEach((line) => {
    const match = menu.find((item) => item.id === line.dishId || item.name === line.name) || menu.find((item) => item.name === line.name);
    if (!match) return;
    const category = dishCategory(line, menu);
    if (!isCategoryPrintable(category, settings)) return;

    if (match.type === 'combo') {
      for (let repeat = 0; repeat < Number(line.qty || 0); repeat += 1) {
        (match.items || []).forEach((componentName) => {
          tickets.push({
            name: componentName,
            qty: 1,
            note: line.note,
            price: 0,
            noPrice: true,
            spacer3cm: isCategorySpacer3cm(category, settings),
          });
        });
      }
    } else if (isCategoryCumulative(category, settings)) {
      tickets.push({
        name: line.name,
        qty: Number(line.qty || 0),
        note: line.note,
        price: Number(line.price || 0),
        spacer3cm: isCategorySpacer3cm(category, settings),
      });
    } else {
      for (let index = 0; index < Number(line.qty || 0); index += 1) {
        tickets.push({
          name: line.name,
          qty: 1,
          note: line.note,
          price: Number(line.price || 0),
          spacer3cm: isCategorySpacer3cm(category, settings),
        });
      }
    }
  });

  return tickets;
}

export function sendViaRawBt(payload) {
  if (typeof window === 'undefined') return false;
  const encoded = btoa(payload);
  window.location.href = `rawbt:base64,${encoded}`;
  return true;
}

export function renderSummaryHtml(lines, orderNum, now, tag, settings = {}) {
  const total = lines.reduce((sum, line) => sum + Number(line.price || 0) * Number(line.qty || 0), 0);
  const itemHtml = lines.map((line) => `
    <div class="line">
      <span>${line.qty}x ${line.name}</span>
      <span>${settings.currency || '€'} ${(Number(line.price || 0) * Number(line.qty || 0)).toFixed(2)}</span>
    </div>
    ${line.note ? `<div class="l-note">— ${line.note}</div>` : ''}
  `).join('');

  return `
  <div class="print-page">
    <div class="p-head">
      <div class="biz">${settings.bizName || 'La Mia Attività'}</div>
      <div class="kind">Scontrino riepilogativo</div>
      <div class="ticket-number">#${formatTicketNum(orderNum, tag)}</div>
      <div class="meta">${now.toLocaleDateString('it-IT')} · ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <hr>
    ${itemHtml}
    <hr>
    <div class="total"><span>Totale</span><span>${settings.currency || '€'} ${total.toFixed(2)}</span></div>
    ${settings.vat ? `<div class="foot">${settings.vat}</div>` : ''}
    <div class="foot">${settings.footer || 'Grazie e arrivederci'}</div>
  </div>`;
}

export function renderKitchenHtml(ticket, orderNum, now, tag, settings = {}) {
  return `
  <div class="print-page${ticket.spacer3cm ? ' spacer-top' : ''}">
    <div class="p-head">
      <div class="ticket-number">#${formatTicketNum(orderNum, tag)}</div>
      <div class="meta">${now.toLocaleDateString('it-IT')} · ${now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}</div>
    </div>
    <hr>
    ${settings.showPricesKitchen && !ticket.noPrice ? `<div class="line"><span>${ticket.qty}x ${ticket.name}</span><span>${settings.currency || '€'} ${(Number(ticket.price || 0) * Number(ticket.qty || 0)).toFixed(2)}</span></div>` : ''}
    <div class="p-item">${ticket.qty}x ${ticket.name}</div>
    ${ticket.note ? `<div class="p-note">— ${ticket.note}</div>` : ''}
  </div>`;
}

export function buildPrintPayload({ lines, orderNum, now, tag = 'A1', menu = [], settings = {} }) {
  const kitchenTickets = getKitchenTicketsForLines(lines, menu, settings);
  let payload = ESC + '@';
  kitchenTickets.forEach((ticket) => {
    payload += buildKitchenEscPos(ticket, orderNum, now, tag, settings);
  });
  if (settings.autoSummary) {
    payload += buildSummaryEscPos(lines, orderNum, now, tag, settings);
  }
  return payload;
}
