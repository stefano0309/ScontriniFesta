// format.js — piccole utility di formattazione condivise

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Codice scontrino completo (etichetta + numero), es. "A-0007".
// Usare sempre questa funzione per mostrare/stampare un numero scontrino,
// mai il solo numero, altrimenti la garanzia di unicità va persa in stampa.
export function formatTicketNum(orderNum, tag) {
  const t = String(tag || '').trim();
  return (t ? t + '-' : '') + String(orderNum).padStart(4, '0');
}

export function money(value, currency = '€') {
  return currency + ' ' + (Number(value) || 0).toFixed(2);
}

export function groupByCategory(items) {
  const groups = {};
  items.forEach((i) => {
    const cat = i.cat && i.cat.trim() ? i.cat.trim() : 'Senza categoria';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(i);
  });
  return groups;
}

export function categoriesOf(menu) {
  return [...new Set(menu.map((d) => (d.cat && d.cat.trim() ? d.cat.trim() : 'Senza categoria')))].sort();
}