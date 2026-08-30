// menu.js — logica di scomposizione ordine -> talloncini cucina, e
// conteggi di vendita/countdown per piatto. Porting 1:1 dell'originale.

export function dishCategory(menu, dishId) {
  const d = menu.find((x) => x.id === dishId);
  return d && d.cat && d.cat.trim() ? d.cat.trim() : 'Senza categoria';
}
export function isCategoryCumulative(settings, cat) {
  return settings.categoryCumulative?.[cat] !== false;
}
export function isCategoryPrintable(settings, cat) {
  return settings.categoryPrintTicket?.[cat] !== false;
}
export function isCategorySpacer3cm(settings, cat) {
  return settings.categorySpacer3cm?.[cat] === true;
}

// Scompone le righe di un ordine/vendita nei singoli talloncini cucina,
// rispettando le regole per categoria: cumulativo/non cumulativo, +3cm
// spaziatore, stampa/non stampa, ed esplosione dei "menu/combo" in un
// talloncino per ciascun piatto incluso.
export function getKitchenTicketsForLines(lines, menu, settings) {
  const tickets = [];
  (lines || []).forEach((l) => {
    const dish = menu.find((m) => m.id === l.dishId) || menu.find((m) => m.name === l.name);
    if (!dish) return;
    const cat = dishCategory(menu, dish.id);
    if (!isCategoryPrintable(settings, cat)) return;

    if (dish.type === 'combo') {
      for (let u = 0; u < Number(l.qty || 0); u++) {
        (dish.items || []).forEach((compName) => {
          tickets.push({ name: compName, qty: 1, note: l.note, price: 0, noPrice: true, spacer3cm: isCategorySpacer3cm(settings, cat) });
        });
      }
    } else if (isCategoryCumulative(settings, cat)) {
      tickets.push({ name: l.name, qty: Number(l.qty || 0), note: l.note, price: Number(l.price || 0), spacer3cm: isCategorySpacer3cm(settings, cat) });
    } else {
      for (let i = 0; i < Number(l.qty || 0); i++) {
        tickets.push({ name: l.name, qty: 1, note: l.note, price: Number(l.price || 0), spacer3cm: isCategorySpacer3cm(settings, cat) });
      }
    }
  });
  return tickets;
}

// Quanti pezzi di un piatto sono stati venduti in questa serata (scontrini
// annullati esclusi).
export function dishSoldQty(salesLog, d) {
  let sold = 0;
  salesLog.forEach((sale) => {
    if (sale.voided) return;
    (sale.lines || []).forEach((l) => {
      if ((l.dishId && l.dishId === d.id) || (!l.dishId && l.name === d.name)) sold += Number(l.qty) || 0;
    });
  });
  return sold;
}

// Pezzi dello stesso piatto già presenti nell'ordine in composizione (non
// ancora stampato).
export function dishDraftQty(order, d) {
  return order.filter((l) => l.name === d.name).reduce((s, l) => s + (Number(l.qty) || 0), 0);
}

export function dishRemainingQty(salesLog, order, d) {
  if (!d.showCountdown || !d.maxQty) return Infinity;
  return d.maxQty - dishSoldQty(salesLog, d) - dishDraftQty(order, d);
}

export function aggregateSalesLog(salesLog) {
  const totals = {};
  let grandTotal = 0;
  let orders = 0;
  salesLog.forEach((entry) => {
    if (entry.voided) return; // un ordine annullato non deve influenzare i totali
    orders++;
    (entry.lines || []).forEach((l) => {
      if (!totals[l.name]) totals[l.name] = { qty: 0, revenue: 0 };
      totals[l.name].qty += l.qty;
      totals[l.name].revenue += l.price * l.qty;
    });
    grandTotal += entry.total;
  });
  return { totals, grandTotal, orders };
}

export function cashAdditionsTotal(cashAdditions) {
  return cashAdditions.reduce((s, a) => s + (Number(a.amount) || 0), 0);
}

// --- Editor di uno scontrino già stampato (Modifica ordine) ---
export function cloneSaleLines(lines) {
  return (lines || [])
    .map((l) => ({
      dishId: l.dishId || '',
      name: l.name || '',
      qty: Math.max(0, Number(l.qty) || 0),
      price: Number(l.price) || 0,
      note: l.note || '',
    }))
    .filter((l) => l.qty > 0);
}

function saleLineKey(line) {
  return String(line.dishId || line.name || '') + '|' + String(line.note || '');
}

// Righe da ristampare dopo una modifica: solo le quantità nette AGGIUNTE
// rispetto a prima, mai l'intero ordine (evita di ristampare talloncini già
// consegnati).
export function positiveLineDelta(beforeLines, afterLines) {
  const before = {};
  const after = {};
  (beforeLines || []).forEach((l) => (before[saleLineKey(l)] = (before[saleLineKey(l)] || 0) + (Number(l.qty) || 0)));
  (afterLines || []).forEach((l) => (after[saleLineKey(l)] = (after[saleLineKey(l)] || 0) + (Number(l.qty) || 0)));

  const result = [];
  (afterLines || []).forEach((l) => {
    const key = saleLineKey(l);
    const alreadyAccounted = result.filter((x) => saleLineKey(x) === key).reduce((s, x) => s + x.qty, 0);
    const wanted = Math.max(0, (after[key] || 0) - (before[key] || 0) - alreadyAccounted);
    if (wanted > 0) result.push({ ...l, qty: wanted });
  });
  return result;
}

export function validateEditedSaleLimits(sale, lines, menu, salesLog) {
  const soldOutside = {};
  salesLog.forEach((s) => {
    if (!s || s === sale || s.voided) return;
    (s.lines || []).forEach((l) => {
      const d = menu.find((x) => x.id === l.dishId) || menu.find((x) => x.name === l.name);
      if (!d || !d.maxQty) return;
      soldOutside[d.id] = (soldOutside[d.id] || 0) + (Number(l.qty) || 0);
    });
  });
  const newQty = {};
  (lines || []).forEach((l) => {
    const d = menu.find((x) => x.id === l.dishId) || menu.find((x) => x.name === l.name);
    if (d && d.maxQty) newQty[d.id] = (newQty[d.id] || 0) + (Number(l.qty) || 0);
  });
  for (const id of Object.keys(newQty)) {
    const d = menu.find((x) => x.id === id);
    if (d && (soldOutside[id] || 0) + newQty[id] > d.maxQty) {
      return `"${d.name}" supererebbe il limite di ${d.maxQty} pezzi (${(soldOutside[id] || 0) + newQty[id]}).`;
    }
  }
  return null;
}