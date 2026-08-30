// csv.js — import menu da CSV, porting 1:1 (rilevazione delimitatore/header,
// normalizzazione prezzo con virgola o simbolo valuta).
import { uid } from './storage';

function detectDelimiter(sampleLine) {
  const commaCount = (sampleLine.match(/,/g) || []).length;
  const semiCount = (sampleLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ';' : ',';
}

function parseCsvLine(line, delim) {
  const out = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else { inQuotes = false; }
      } else { cur += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === delim) { out.push(cur); cur = ''; }
      else { cur += ch; }
    }
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseCsvMenu(text) {
  const lines = text.split(/\r\n|\n|\r/).filter((l) => l.trim() !== '');
  if (lines.length === 0) return { items: [], errors: ['Il file è vuoto.'] };
  const delim = detectDelimiter(lines[0]);
  let rows = lines.map((l) => parseCsvLine(l, delim));
  const headerCandidates = ['nome', 'piatto', 'name', 'prezzo', 'price', 'categoria', 'category', 'cat'];
  const firstRowLower = rows[0].map((c) => c.toLowerCase());
  const looksLikeHeader = firstRowLower.some((c) => headerCandidates.includes(c));
  let nameIdx = 0, priceIdx = 1, catIdx = 2;
  if (looksLikeHeader) {
    nameIdx = firstRowLower.findIndex((c) => ['nome', 'piatto', 'name'].includes(c));
    priceIdx = firstRowLower.findIndex((c) => ['prezzo', 'price'].includes(c));
    catIdx = firstRowLower.findIndex((c) => ['categoria', 'category', 'cat'].includes(c));
    if (nameIdx === -1) nameIdx = 0;
    if (priceIdx === -1) priceIdx = 1;
    if (catIdx === -1) catIdx = 2;
    rows = rows.slice(1);
  }
  const items = [];
  const errors = [];
  rows.forEach((row, idx) => {
    const rowNum = idx + (looksLikeHeader ? 2 : 1);
    const name = (row[nameIdx] || '').trim();
    let priceRaw = (row[priceIdx] || '').trim();
    const cat = (row[catIdx] || '').trim();
    if (!name) { errors.push(`Riga ${rowNum}: nome mancante, saltata.`); return; }
    priceRaw = priceRaw.replace(/[€\s]/g, '').replace(',', '.');
    const price = parseFloat(priceRaw);
    if (isNaN(price) || price < 0) { errors.push(`Riga ${rowNum}: prezzo non valido, saltata.`); return; }
    items.push({ id: uid(), name, price, cat, type: 'dish', items: [], showInCashier: true });
  });
  return { items, errors };
}