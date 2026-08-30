import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  safeGet, safeSet, uid,
  getDeviceId, getDeviceTag, setDeviceTagLocal, normalizeTagInput,
  saveOrderDraft, clearOrderDraft,
} from '../utils/storage';
import { useStateRef } from '../utils/useStateRef';
import { formatTicketNum, categoriesOf } from '../utils/format';
import {
  getKitchenTicketsForLines, dishSoldQty, dishDraftQty, dishRemainingQty,
  aggregateSalesLog, cashAdditionsTotal, cloneSaleLines, positiveLineDelta,
  validateEditedSaleLimits,
} from '../utils/menu';
import {
  buildKitchenEscPos, buildSummaryEscPos, buildCloseSummaryEscPos,
  buildCloseSummaryHtmlPage, renderKitchenPage, renderSummaryPage,
  sendViaRawBtAndWait, sendViaRawBt, printHtmlPages, ESC,
} from '../utils/printing';

const DEFAULT_SETTINGS = {
  bizName: 'La Mia Attività',
  footer: 'Grazie e arrivederci',
  vat: '',
  currency: '€',
  paperWidth: 58,
  showPricesKitchen: false,
  autoSummary: true,
  printMethod: 'rawbt',
  rawbtCut: false,
  rawbtCutFeedLines: 5,
  theme: 'dark',
  categoryCumulative: {},
  categorySpacer3cm: {},
  categoryPrintTicket: {},
};
const DEFAULT_CREDS = { username: 'admin', password: 'admin' };

const CassaContext = createContext(null);

export function useCassa() {
  const ctx = useContext(CassaContext);
  if (!ctx) throw new Error('useCassa deve essere usato dentro <CassaProvider>');
  return ctx;
}

export function CassaProvider({ children }) {
  // ---------------- STATO ----------------
  const [menu, setMenu, menuRef] = useStateRef(() => safeGet('menu-items', []));
  const [order, setOrder, orderRef] = useStateRef(() => safeGet('current-order-draft', []));
  const [ticketCounter, setTicketCounter, ticketCounterRef] = useStateRef(() => safeGet('ticket-counter', 1));
  const [settings, setSettings, settingsRef] = useStateRef(() => normalizeSettingsObj(Object.assign({}, DEFAULT_SETTINGS, safeGet('app-settings', {}))));
  const [creds, setCreds, credsRef] = useStateRef(() => safeGet('admin-creds', DEFAULT_CREDS));
  const [salesLog, setSalesLog, salesLogRef] = useStateRef(() => safeGet('sales-log', []));
  const [cashFloat, setCashFloat, cashFloatRef] = useStateRef(() => safeGet('cash-float', { amount: 0, note: '', setAt: null }));
  const [cashAdditions, setCashAdditions, cashAdditionsRef] = useStateRef(() => safeGet('cash-additions', []));
  // Nota: gestione stampanti/assegnazioni per categoria non presente nello
  // script originale (quello usa solo il bridge esterno printers-ui.js) — qui
  // viene solo persistita localmente per far funzionare il tab dedicato.
  const [printers, setPrinters, printersRef] = useStateRef(() => safeGet('printers', []));
  const [printerAssignments, setPrinterAssignments, printerAssignmentsRef] = useStateRef(() => safeGet('printer-assignments', {}));
  const [deviceTag, setDeviceTagState] = useState(() => getDeviceTag());

  const [firebaseReady, setFirebaseReady] = useState(!!window.firebaseReady);
  const [firebaseOfflineWarned, setFirebaseOfflineWarned] = useState(false);
  const [adminLoggedIn, setAdminLoggedIn] = useState(false);

  const [flashState, setFlashState] = useState(null); // { text, isError, key }
  const [dataWarning, setDataWarning] = useState(null);
  const [saleEditorSale, setSaleEditorSale] = useState(null); // scontrino attualmente in modifica (null = modale chiusa)

  const firebaseSyncStarted = useRef(false);

  // ---------------- FLASH / WARNING ----------------
  const flash = useCallback((text, isError = false) => {
    setFlashState({ text, isError, key: Date.now() });
  }, []);
  const dismissWarning = useCallback(() => setDataWarning(null), []);

  useEffect(() => {
    const onWarn = (e) => setDataWarning(e.detail.message);
    window.addEventListener('data-warning', onWarn);
    return () => window.removeEventListener('data-warning', onWarn);
  }, []);

  function normalizeSettingsObj(s) {
    const out = { ...s };
    if (!out.categoryCumulative) out.categoryCumulative = {};
    if (!out.categorySpacer3cm) out.categorySpacer3cm = {};
    if (!out.categoryPrintTicket) out.categoryPrintTicket = {};
    if (!out.theme) out.theme = 'dark';
    if (!out.rawbtCutFeedLines) out.rawbtCutFeedLines = 5;
    return out;
  }

  // Applica il tema al documento
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', settings.theme === 'light' ? 'light' : 'dark');
  }, [settings.theme]);

  // ---------------- CHIAVI FIREBASE PER-VENDITA ----------------
  function saleKey(sale) {
    if (sale._fbKey) return sale._fbKey;
    const owner = sale.deviceId || getDeviceId();
    return 'order_' + String(sale.orderNum).padStart(4, '0') + '__' + owner;
  }
  function saleForStorage(sale) {
    const { _fbKey, ...rest } = sale;
    return rest;
  }

  // ---------------- SALVATAGGI (locale + Firebase) ----------------
  const saveMenu = useCallback(async (nextMenu) => {
    const localOk = safeSet('menu-items', nextMenu);
    if (!window.firebaseReady) return localOk;
    try {
      const data = {};
      nextMenu.forEach((item) => { data[item.id] = item; });
      await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/menu'), data);
      return true;
    } catch (e) {
      console.error('Firebase saveMenu:', e);
      setDataWarning('Menu salvato localmente, ma non sincronizzato con Firebase. Controlla la connessione.');
      return localOk;
    }
  }, []);

  const saveCounter = useCallback(async (n) => {
    const localOk = safeSet('ticket-counter', n);
    if (!window.firebaseReady) return localOk;
    try {
      await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/counters/' + getDeviceTag()), n);
      return true;
    } catch (e) {
      console.error('Firebase saveCounter:', e);
      return localOk;
    }
  }, []);

  const saveSettingsRemote = useCallback(async (nextSettings) => {
    const localOk = safeSet('app-settings', nextSettings);
    if (!window.firebaseReady) return localOk;
    try {
      await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/settings'), nextSettings);
      return true;
    } catch (e) {
      console.error('Firebase saveSettings:', e);
      setDataWarning('Impostazioni salvate localmente, ma non sincronizzate con Firebase.');
      return localOk;
    }
  }, []);

  // Le credenziali admin restano locali al dispositivo e NON vengono pubblicate su Firebase.
  const saveCredsLocal = useCallback((c) => safeSet('admin-creds', c), []);

  const saveSalesLogFull = useCallback(async (nextLog) => {
    const localOk = safeSet('sales-log', nextLog);
    if (!window.firebaseReady) return localOk;
    try {
      const data = {};
      nextLog.forEach((entry) => { data['order_' + String(entry.orderNum).padStart(4, '0')] = entry; });
      await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/sales'), data);
      return true;
    } catch (e) {
      console.error('Firebase saveSalesLog:', e);
      setDataWarning('Vendite salvate localmente, ma non sincronizzate con Firebase.');
      return localOk;
    }
  }, []);

  // Scrittura mirata di UNA sola vendita (update sulla singola chiave): due
  // dispositivi che registrano nello stesso momento non si cancellano a vicenda.
  const saveSaleEntry = useCallback(async (sale, nextLog) => {
    const localOk = safeSet('sales-log', nextLog);
    if (!window.firebaseReady) return localOk;
    try {
      const updates = {};
      updates[saleKey(sale)] = saleForStorage(sale);
      await window.FirebaseCassa.update(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/sales'), updates);
      return true;
    } catch (e) {
      console.error('Firebase saveSaleEntry:', e);
      setDataWarning('Vendita salvata localmente, ma non sincronizzata con Firebase.');
      return localOk;
    }
  }, []);

  const saveCashFloatRemote = useCallback(async (cf) => {
    const localOk = safeSet('cash-float', cf);
    if (!window.firebaseReady) return localOk;
    try {
      await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/cashFloat'), cf);
      return true;
    } catch (e) {
      console.error('Firebase saveCashFloat:', e);
      setDataWarning('Fondo cassa salvato localmente, ma non sincronizzato con Firebase.');
      return localOk;
    }
  }, []);

  // ---------------- SYNC FIREBASE (bootstrap + listener) ----------------
  const verifyDeviceTagClaim = useCallback(async () => {
    if (!window.firebaseReady || !window.FirebaseCassa) return;
    const tag = getDeviceTag();
    try {
      const { db, ref, runTransaction } = window.FirebaseCassa;
      const tagRef = ref(db, 'cassa/deviceTags/' + tag);
      const result = await runTransaction(tagRef, (current) => {
        if (current && current.deviceId && current.deviceId !== getDeviceId()) return; // conflitto: abort
        return { deviceId: getDeviceId(), claimedAt: new Date().toISOString() };
      });
      if (!result.committed) {
        setDataWarning(`ATTENZIONE: l'etichetta scontrini "${tag}" di questo dispositivo risulta usata anche da un altro dispositivo collegato! I numeri scontrino potrebbero duplicarsi. Vai in Impostazioni e assegna un'etichetta diversa a uno dei due dispositivi il prima possibile.`);
      }
    } catch (e) {
      console.error('Firebase verifyDeviceTagClaim:', e);
    }
  }, []);

  const bootstrapFirebaseFromLocal = useCallback(async () => {
    if (!window.firebaseReady || !window.FirebaseCassa) return;
    await verifyDeviceTagClaim();
    try {
      const { db, ref, get, set, update, push } = window.FirebaseCassa;
      const [menuSnap, settingsSnap, counterSnap, salesSnap, cashFloatSnap] = await Promise.all([
        get(ref(db, 'cassa/menu')),
        get(ref(db, 'cassa/settings')),
        get(ref(db, 'cassa/counters/' + getDeviceTag())),
        get(ref(db, 'cassa/sales')),
        get(ref(db, 'cassa/cashFloat')),
      ]);
      const writes = [];
      if (!menuSnap.exists() && menuRef.current.length) writes.push(set(ref(db, 'cassa/menu'), Object.fromEntries(menuRef.current.map((x) => [x.id, x]))));
      if (!settingsSnap.exists()) writes.push(set(ref(db, 'cassa/settings'), settingsRef.current));
      if (!counterSnap.exists()) writes.push(set(ref(db, 'cassa/counters/' + getDeviceTag()), ticketCounterRef.current));
      if (!cashFloatSnap.exists() && cashFloatRef.current.setAt) writes.push(set(ref(db, 'cassa/cashFloat'), cashFloatRef.current));

      const pendingAdditions = cashAdditionsRef.current.filter((a) => !a._fbKey);
      pendingAdditions.forEach((a) => {
        const newRef = push(ref(db, 'cassa/cashAdditions'));
        const { _fbKey, ...toStore } = a;
        writes.push(set(newRef, toStore).then(() => { a._fbKey = newRef.key; }));
      });

      const serverSalesData = salesSnap.exists() ? (salesSnap.val() || {}) : {};
      const serverKeys = new Set(Object.keys(serverSalesData));
      const pendingSales = {};
      salesLogRef.current.forEach((sale) => {
        const key = saleKey(sale);
        if (!serverKeys.has(key)) pendingSales[key] = sale;
      });
      if (Object.keys(pendingSales).length) writes.push(update(ref(db, 'cassa/sales'), pendingSales));

      if (writes.length) await Promise.all(writes);
    } catch (e) {
      console.error('Firebase bootstrap:', e);
    }
  }, [verifyDeviceTagClaim]);

  const setupFirebaseSync = useCallback(() => {
    if (firebaseSyncStarted.current || !window.firebaseReady || !window.FirebaseCassa) return;
    firebaseSyncStarted.current = true;
    const { db, ref, onValue } = window.FirebaseCassa;

    onValue(ref(db, 'cassa/menu'), (snap) => {
      const data = snap.val();
      if (data) {
        const next = Array.isArray(data) ? data : Object.values(data);
        setMenu(next);
        safeSet('menu-items', next);
      }
    });

    onValue(ref(db, 'cassa/settings'), (snap) => {
      const data = snap.val();
      if (data) {
        const next = normalizeSettingsObj(Object.assign({}, settingsRef.current, data));
        setSettings(next);
        safeSet('app-settings', next);
      }
    });

    onValue(ref(db, 'cassa/sales'), (snap) => {
      const data = snap.val();
      const next = data
        ? Object.entries(data).map(([key, sale]) => ({ ...sale, _fbKey: key })).sort((a, b) => new Date(a.ts) - new Date(b.ts))
        : [];
      setSalesLog(next);
      safeSet('sales-log', next);
    });

    onValue(ref(db, 'cassa/cashFloat'), (snap) => {
      const data = snap.val();
      const next = data || { amount: 0, note: '', setAt: null };
      setCashFloat(next);
      safeSet('cash-float', next);
    });

    onValue(ref(db, 'cassa/cashAdditions'), (snap) => {
      const data = snap.val();
      const next = data
        ? Object.entries(data).map(([key, a]) => ({ ...a, _fbKey: key })).sort((a, b) => new Date(a.ts) - new Date(b.ts))
        : [];
      setCashAdditions(next);
      safeSet('cash-additions', next);
    });

    console.log('Sincronizzazione Firebase attiva');
  }, [setMenu, setSettings, setSalesLog, setCashFloat, setCashAdditions]);

  useEffect(() => {
    const onFirebaseReady = () => {
      const ready = !!window.firebaseReady;
      setFirebaseReady(ready);
      if (ready) {
        setFirebaseOfflineWarned(false);
        bootstrapFirebaseFromLocal().then(() => setupFirebaseSync());
        flash('Firebase sincronizzato');
      } else {
        setFirebaseOfflineWarned((already) => {
          if (!already) setDataWarning('Firebase non disponibile: la cassa continua in modalità locale. Riproverò automaticamente a riconnettermi.');
          return true;
        });
      }
    };
    window.addEventListener('firebase-ready', onFirebaseReady);
    // Se Firebase è già pronto al mount, collega subito.
    if (window.firebaseReady) onFirebaseReady();
    return () => window.removeEventListener('firebase-ready', onFirebaseReady);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Persisti la bozza ordine ad ogni modifica + al backgrounding dell'app.
  useEffect(() => { saveOrderDraft(order); }, [order]);
  useEffect(() => {
    const onVisibility = () => { if (document.visibilityState === 'hidden') saveOrderDraft(orderRef.current); };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onVisibility);
    };
  }, [orderRef]);

  // ---------------- ETICHETTA DISPOSITIVO ----------------
  const setDeviceTagAction = useCallback(async (rawTag) => {
    const tag = normalizeTagInput(rawTag);
    if (!tag) return { ok: false, error: 'Inserisci un\'etichetta valida (lettere/numeri, es. "A").' };

    if (window.firebaseReady) {
      try {
        const { db, ref, runTransaction } = window.FirebaseCassa;
        const tagRef = ref(db, 'cassa/deviceTags/' + tag);
        const result = await runTransaction(tagRef, (current) => {
          if (current && current.deviceId && current.deviceId !== getDeviceId()) return; // conflitto
          return { deviceId: getDeviceId(), claimedAt: new Date().toISOString() };
        });
        if (!result.committed) {
          return { ok: false, error: `L'etichetta "${tag}" è già in uso su un altro dispositivo collegato. Scegline un'altra (es. una lettera diversa).` };
        }
      } catch (e) {
        console.error('Firebase setDeviceTag:', e);
      }
    }
    setDeviceTagLocal(tag);
    setDeviceTagState(tag);
    return { ok: true, offline: !window.firebaseReady };
  }, []);

  // ---------------- MENU (ADMIN) ----------------
  const addDish = useCallback(async (dish) => {
    const next = [...menuRef.current, {
      id: uid(), name: dish.name, price: dish.price, cat: dish.cat || '',
      type: dish.type || 'dish', items: dish.items || [],
      showInCashier: true, showSalesCounter: false, showCountdown: false, maxQty: 0,
    }];
    setMenu(next);
    await saveMenu(next);
  }, [saveMenu]);

  const updateDish = useCallback(async (id, patch) => {
    const next = menuRef.current.map((d) => (d.id === id ? { ...d, ...patch } : d));
    setMenu(next);
    await saveMenu(next);
  }, [saveMenu]);

  const deleteDish = useCallback(async (id) => {
    const next = menuRef.current.filter((d) => d.id !== id);
    setMenu(next);
    await saveMenu(next);
    flash('Piatto eliminato');
  }, [saveMenu, flash]);

  const importMenu = useCallback(async (items, replace) => {
    const next = replace ? items : [...menuRef.current, ...items];
    setMenu(next);
    await saveMenu(next);
  }, [saveMenu]);

  // ---------------- ORDINE CORRENTE (CASSA) ----------------
  const addToOrder = useCallback((dishId) => {
    const d = menuRef.current.find((x) => x.id === dishId);
    if (!d) return;
    if (d.showCountdown && d.maxQty && dishRemainingQty(salesLogRef.current, orderRef.current, d) <= 0) {
      flash(`"${d.name}" ha raggiunto il limite di ${d.maxQty} pezzi per questa serata.`, true);
      return;
    }
    const existing = orderRef.current.find((l) => l.dishId === dishId && !l.note);
    let next;
    if (existing) {
      next = orderRef.current.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
    } else {
      next = [...orderRef.current, { dishId, name: d.name, price: d.price, qty: 1, note: '' }];
    }
    setOrder(next);
  }, [flash]);

  const changeQty = useCallback((idx, delta) => {
    const next = [...orderRef.current];
    if (!next[idx]) return;
    next[idx] = { ...next[idx], qty: next[idx].qty + delta };
    if (next[idx].qty <= 0) next.splice(idx, 1);
    setOrder(next);
  }, []);

  const removeOrderLine = useCallback((idx) => {
    const next = [...orderRef.current];
    next.splice(idx, 1);
    setOrder(next);
  }, []);

  const clearOrder = useCallback(() => {
    setOrder([]);
    clearOrderDraft();
  }, []);

  const reserveTicketNumber = useCallback(async () => {
    const n = ticketCounterRef.current;
    const next = n + 1;
    setTicketCounter(next);
    await saveCounter(next);
    if (window.firebaseReady) {
      window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/counters/' + getDeviceTag()), next)
        .catch((e) => console.error('Firebase mirror contatore:', e));
    }
    return n;
  }, [saveCounter]);

  const recordSale = useCallback(async (orderNum, orderLines, now) => {
    const total = orderLines.reduce((s, l) => s + l.price * l.qty, 0);
    const sale = {
      orderNum,
      ts: now.toISOString(),
      lines: orderLines.map((l) => ({ dishId: l.dishId || '', name: l.name, qty: l.qty, price: l.price, note: l.note || '' })),
      total,
      deviceId: getDeviceId(),
      deviceTag: getDeviceTag(),
      voided: false,
    };
    const filtered = salesLogRef.current.filter((x) => !(Number(x.orderNum) === Number(orderNum) && (x.deviceId || '') === getDeviceId()));
    const next = [...filtered, sale].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    setSalesLog(next);
    const saved = await saveSaleEntry(sale, next);
    const label = formatTicketNum(orderNum, sale.deviceTag);
    if (!saved) setDataWarning(`L'ordine #${label} è stato stampato ma il registro cassa è stato salvato solo localmente.`);
    return sale;
  }, [saveSaleEntry]);

  // Invio + stampa completo dell'ordine corrente (RawBT oppure dialogo).
  const printOrder = useCallback(async () => {
    if (orderRef.current.length === 0) return { ok: false };
    const now = new Date();
    const orderNum = await reserveTicketNumber();
    const tag = getDeviceTag();
    const kitchenTickets = getKitchenTicketsForLines(orderRef.current, menuRef.current, settingsRef.current);

    if (settingsRef.current.printMethod === 'rawbt') {
      let payload = ESC + '@';
      kitchenTickets.forEach((t) => { payload += buildKitchenEscPos(t, orderNum, now, tag, settingsRef.current); });
      if (settingsRef.current.autoSummary) payload += buildSummaryEscPos(orderRef.current, orderNum, now, tag, settingsRef.current);
      const result = await sendViaRawBtAndWait(payload);
      if (!result.ok) {
        flash('Stampa non riuscita: RawBT non è disponibile. Ordine conservato, riprova o cambia metodo di stampa nelle Impostazioni.', true);
        return { ok: false };
      }
      flash('Talloncini inviati a RawBT');
    } else {
      let pagesHtml = kitchenTickets.map((t) => renderKitchenPage(t, orderNum, now, tag, settingsRef.current)).join('');
      if (settingsRef.current.autoSummary) pagesHtml += renderSummaryPage(orderRef.current, orderNum, now, tag, settingsRef.current);
      printHtmlPages(pagesHtml, settingsRef.current);
      flash('Ordine inviato e talloncini generati');
    }

    await recordSale(orderNum, orderRef.current, now);
    clearOrder();
    return { ok: true, orderNum };
  }, [reserveTicketNumber, recordSale, clearOrder, flash]);

  // ---------------- ANNULLA / RIPRISTINA VENDITA ----------------
  const setSaleVoided = useCallback(async (sale, voided, reason) => {
    if (!sale) return false;
    const updated = { ...sale, voided, voidedAt: voided ? new Date().toISOString() : null, voidedReason: voided ? (reason || '') : '' };
    const next = salesLogRef.current.map((x) => (x === sale ? updated : x));
    setSalesLog(next);
    const label = formatTicketNum(updated.orderNum, updated.deviceTag);

    if (!window.firebaseReady) {
      safeSet('sales-log', next);
      setDataWarning(`Ordine #${label} ${voided ? 'annullato' : 'ripristinato'} solo localmente (Firebase non disponibile).`);
      return true;
    }
    try {
      const updates = {};
      updates[saleKey(updated)] = saleForStorage(updated);
      await window.FirebaseCassa.update(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/sales'), updates);
      safeSet('sales-log', next);
      return true;
    } catch (e) {
      console.error('Firebase setSaleVoided:', e);
      safeSet('sales-log', next);
      setDataWarning(`Ordine #${label} ${voided ? 'annullato' : 'ripristinato'} solo localmente, non ancora sincronizzato.`);
      return false;
    }
  }, []);

  // ---------------- MODIFICA ORDINE GIÀ STAMPATO ----------------
  const getLatestEditableSale = useCallback(() => {
    return salesLogRef.current.filter((s) => s && !s.voided).sort((a, b) => new Date(b.ts) - new Date(a.ts))[0] || null;
  }, []);

  const openSaleEditor = useCallback((sale) => {
    if (!sale || sale.voided) return;
    setSaleEditorSale(sale);
  }, []);
  const closeSaleEditor = useCallback(() => setSaleEditorSale(null), []);

  const printAddedSaleLines = useCallback(async (lines, sale) => {
    const tickets = getKitchenTicketsForLines(lines, menuRef.current, settingsRef.current);
    if (!tickets.length) return { ok: true, printed: 0 };
    const now = new Date();
    const orderNum = sale.orderNum;
    const tag = sale.deviceTag || getDeviceTag();
    if (settingsRef.current.printMethod === 'rawbt') {
      let payload = ESC + '@';
      tickets.forEach((t) => { payload += buildKitchenEscPos(t, orderNum, now, tag, settingsRef.current); });
      const result = await sendViaRawBtAndWait(payload);
      return { ok: !!result.ok, printed: tickets.length };
    }
    const pagesHtml = tickets.map((t) => renderKitchenPage(t, orderNum, now, tag, settingsRef.current)).join('');
    printHtmlPages(pagesHtml, settingsRef.current);
    return { ok: true, printed: tickets.length };
  }, []);

  const saveEditedSale = useCallback(async (sale, draftLines) => {
    if (!sale) return { ok: false };
    if (!draftLines.length) { flash("L'ordine non può restare vuoto.", true); return { ok: false }; }
    const limitError = validateEditedSaleLimits(sale, draftLines, menuRef.current, salesLogRef.current);
    if (limitError) { flash(limitError, true); return { ok: false }; }

    const before = cloneSaleLines(sale.lines || []);
    const after = cloneSaleLines(draftLines);
    const added = positiveLineDelta(before, after);
    const changed = JSON.stringify(before) !== JSON.stringify(after);
    if (!changed) return { ok: true, unchanged: true };

    const printResult = await printAddedSaleLines(added, sale);
    if (!printResult.ok) {
      flash('Modifica non salvata: la stampa dei talloncini aggiunti non è riuscita.', true);
      return { ok: false };
    }

    const updatedSale = {
      ...sale,
      lines: after,
      total: after.reduce((s, l) => s + l.price * l.qty, 0),
      modifiedAt: new Date().toISOString(),
      lastEdit: { added, beforeTotal: before.reduce((s, l) => s + l.price * l.qty, 0), afterTotal: after.reduce((s, l) => s + l.price * l.qty, 0), modifiedAt: new Date().toISOString() },
    };
    const next = salesLogRef.current
      .map((x) => (x === sale || saleKey(x) === saleKey(sale) ? updatedSale : x))
      .sort((a, b) => new Date(a.ts) - new Date(b.ts));
    setSalesLog(next);
    const saved = await saveSaleEntry(updatedSale, next);
    if (saved) flash(added.length ? `Ordine #${formatTicketNum(updatedSale.orderNum, updatedSale.deviceTag)} aggiornato: ${added.reduce((s, l) => s + l.qty, 0)} talloncini aggiunti.` : `Ordine #${formatTicketNum(updatedSale.orderNum, updatedSale.deviceTag)} aggiornato.`);
    else setDataWarning('Ordine modificato localmente, ma non ancora sincronizzato con Firebase.');
    return { ok: true };
  }, [flash, printAddedSaleLines, saveSaleEntry]);

  // ---------------- RISTAMPA SCONTRINO ----------------
  const printReceipt = useCallback(async (sale) => {
    if (!sale) return false;
    const orderNum = sale.orderNum;
    const tag = sale.deviceTag || getDeviceTag();
    const lines = Array.isArray(sale.lines) ? sale.lines : [];
    const now = sale.ts ? new Date(sale.ts) : new Date();
    const label = formatTicketNum(orderNum, tag);

    if (settingsRef.current.printMethod === 'rawbt') {
      const payload = ESC + '@' + buildSummaryEscPos(lines, orderNum, now, tag, settingsRef.current);
      const result = await sendViaRawBtAndWait(payload);
      if (!result.ok) { flash('Ristampa non riuscita: RawBT non è disponibile.', true); return false; }
      flash('Scontrino #' + label + ' ristampato via RawBT');
      return true;
    }
    printHtmlPages(renderSummaryPage(lines, orderNum, now, tag, settingsRef.current), settingsRef.current);
    flash('Scontrino #' + label + ' ristampato');
    return true;
  }, [flash]);

  // ---------------- FONDO CASSA / AGGIUNTE CONTANTE ----------------
  const saveCashFloatAction = useCallback(async (data) => {
    const next = { amount: Math.max(0, Number(data.amount) || 0), note: data.note || '', setAt: new Date().toISOString() };
    setCashFloat(next);
    const saved = await saveCashFloatRemote(next);
    return saved;
  }, [saveCashFloatRemote]);

  const addCashAddition = useCallback(async (amount, note) => {
    const entry = { amount: Math.max(0, Number(amount) || 0), note: note || '', ts: new Date().toISOString(), deviceId: getDeviceId(), deviceTag: getDeviceTag() };
    const next = [...cashAdditionsRef.current, entry].sort((a, b) => new Date(a.ts) - new Date(b.ts));
    setCashAdditions(next);
    safeSet('cash-additions', next);

    if (!window.firebaseReady) {
      setDataWarning('Aggiunta di cassa salvata solo localmente (Firebase non disponibile).');
      return entry;
    }
    try {
      const newRef = window.FirebaseCassa.push(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/cashAdditions'));
      await window.FirebaseCassa.set(newRef, entry);
      entry._fbKey = newRef.key;
    } catch (e) {
      console.error('Firebase addCashAdditionEntry:', e);
      setDataWarning('Aggiunta di cassa salvata solo localmente, non ancora sincronizzata.');
    }
    return entry;
  }, []);

  const removeCashAddition = useCallback(async (entry) => {
    const next = cashAdditionsRef.current.filter((a) => a !== entry);
    setCashAdditions(next);
    safeSet('cash-additions', next);
    if (window.firebaseReady && entry._fbKey) {
      try {
        await window.FirebaseCassa.remove(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/cashAdditions/' + entry._fbKey));
      } catch (e) {
        console.error('Firebase removeCashAdditionEntry:', e);
        setDataWarning('Eliminazione non sincronizzata con Firebase (verrà ripristinata alla prossima connessione).');
      }
    }
  }, []);

  // ---------------- CHIUSURA CASSA ----------------
  const resetClose = useCallback(async () => {
    setSalesLog([]);
    await saveSalesLogFull([]);
    const emptyFloat = { amount: 0, note: '', setAt: null };
    setCashFloat(emptyFloat);
    await saveCashFloatRemote(emptyFloat);
    setCashAdditions([]);
    safeSet('cash-additions', []);
    if (window.firebaseReady) {
      try { await window.FirebaseCassa.set(window.FirebaseCassa.ref(window.FirebaseCassa.db, 'cassa/cashAdditions'), null); }
      catch (e) { console.error('Firebase reset cashAdditions:', e); }
    }
    flash('Cassa chiusa e azzerata');
  }, [saveSalesLogFull, saveCashFloatRemote, flash]);

  const printCloseSummary = useCallback(() => {
    const { totals, grandTotal, orders } = aggregateSalesLog(salesLogRef.current);
    const additionsTotal = cashAdditionsTotal(cashAdditionsRef.current);
    const payload = {
      totals, grandTotal, orders,
      cashFloat: cashFloatRef.current,
      cashAdditions: cashAdditionsRef.current,
      additionsTotal,
      settings: settingsRef.current,
    };
    if (salesLogRef.current.length === 0 && cashAdditionsRef.current.length === 0 && !cashFloatRef.current.setAt) {
      flash('Nessun dato da riepilogare');
      return;
    }
    if (settingsRef.current.printMethod === 'rawbt') {
      sendViaRawBt(ESC + '@' + buildCloseSummaryEscPos(payload));
      flash('Riepilogo inviato a RawBT');
    } else {
      printHtmlPages(buildCloseSummaryHtmlPage(payload), settingsRef.current);
      flash('Riepilogo generato');
    }
  }, [flash]);

  // ---------------- IMPOSTAZIONI / CREDENZIALI ----------------
  const saveSettingsAction = useCallback(async (patch) => {
    const next = normalizeSettingsObj({ ...settingsRef.current, ...patch });
    setSettings(next);
    await saveSettingsRemote(next);
    flash('Impostazioni salvate.');
    return next;
  }, [saveSettingsRemote, flash]);

  const saveCredsAction = useCallback((c) => {
    setCreds(c);
    saveCredsLocal(c);
  }, [saveCredsLocal]);

  const resetCounter = useCallback(async () => {
    setTicketCounter(1);
    await saveCounter(1);
    flash('Contatore reimpostato');
  }, [saveCounter, flash]);

  const exportSettingsFile = useCallback(() => {
    const payload = { exportedAt: new Date().toISOString(), app: 'talloncini-cassa', version: 2, menu: menuRef.current, settings: settingsRef.current, creds: credsRef.current };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `talloncini-cassa-impostazioni-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const importSettingsFromPayload = useCallback(async (payload) => {
    if (!payload || typeof payload !== 'object') throw new Error('File non valido');
    if (Array.isArray(payload.menu)) { setMenu(payload.menu); await saveMenu(payload.menu); }
    if (payload.settings && typeof payload.settings === 'object') {
      const next = normalizeSettingsObj({ ...settingsRef.current, ...payload.settings });
      setSettings(next);
      await saveSettingsRemote(next);
    }
    if (payload.creds && payload.creds.username && payload.creds.password) {
      setCreds(payload.creds);
      saveCredsLocal(payload.creds);
    }
  }, [saveMenu, saveSettingsRemote, saveCredsLocal]);

  // ---------------- STAMPANTI (locale, bridge printers-ui.js) ----------------
  const addPrinter = useCallback((printer) => {
    const next = [...printersRef.current, { id: uid(), ...printer }];
    setPrinters(next);
    safeSet('printers', next);
  }, []);
  const deletePrinter = useCallback((id) => {
    const next = printersRef.current.filter((p) => p.id !== id);
    setPrinters(next);
    safeSet('printers', next);
    // rimuove anche eventuali assegnazioni di categoria che puntavano a questa stampante
    const nextAssign = Object.fromEntries(Object.entries(printerAssignmentsRef.current).filter(([, v]) => v !== id));
    setPrinterAssignments(nextAssign);
    safeSet('printer-assignments', nextAssign);
  }, []);
  const savePrinterAssignments = useCallback((assignments) => {
    setPrinterAssignments(assignments);
    safeSet('printer-assignments', assignments);
  }, []);

  // ---------------- LOGIN ADMIN ----------------
  const login = useCallback((username, password) => {
    if (username === credsRef.current.username && password === credsRef.current.password) {
      setAdminLoggedIn(true);
      return true;
    }
    return false;
  }, []);
  const logout = useCallback(() => setAdminLoggedIn(false), []);

  // ---------------- VALORI DERIVATI ----------------
  const categories = useMemo(() => categoriesOf(menu), [menu]);

  const value = useMemo(() => ({
    // stato
    menu, order, ticketCounter, settings, creds, salesLog, cashFloat, cashAdditions,
    deviceId: getDeviceId(), deviceTag, firebaseReady, adminLoggedIn,
    flashState, dataWarning, categories, saleEditorSale,
    printers, printerAssignments,

    // helper puri
    dishSoldQty: (d) => dishSoldQty(salesLog, d),
    dishDraftQty: (d) => dishDraftQty(order, d),
    dishRemainingQty: (d) => dishRemainingQty(salesLog, order, d),
    formatTicketNum,
    aggregateSalesLog: () => aggregateSalesLog(salesLog),
    cashAdditionsTotal: () => cashAdditionsTotal(cashAdditions),
    getKitchenTicketsForLines: (lines) => getKitchenTicketsForLines(lines, menu, settings),

    // azioni
    flash, dismissWarning,
    addDish, updateDish, deleteDish, importMenu,
    addToOrder, changeQty, removeOrderLine, clearOrder, printOrder,
    getLatestEditableSale, saveEditedSale, setSaleVoided, printReceipt,
    openSaleEditor, closeSaleEditor,
    saveCashFloat: saveCashFloatAction, addCashAddition, removeCashAddition,
    resetClose, printCloseSummary,
    saveSettings: saveSettingsAction, saveCreds: saveCredsAction,
    setDeviceTag: setDeviceTagAction, resetCounter,
    exportSettingsFile, importSettingsFromPayload,
    addPrinter, deletePrinter, savePrinterAssignments,
    login, logout,
  }), [
    menu, order, ticketCounter, settings, creds, salesLog, cashFloat, cashAdditions,
    printers, printerAssignments,
    deviceTag, firebaseReady, adminLoggedIn, flashState, dataWarning, categories,
    flash, dismissWarning, addDish, updateDish, deleteDish, importMenu,
    addToOrder, changeQty, removeOrderLine, clearOrder, printOrder,
    getLatestEditableSale, saveEditedSale, setSaleVoided, printReceipt,
    openSaleEditor, closeSaleEditor,
    saveCashFloatAction, addCashAddition, removeCashAddition,
    resetClose, printCloseSummary, saveSettingsAction, saveCredsAction,
    setDeviceTagAction, resetCounter, exportSettingsFile, importSettingsFromPayload,
    addPrinter, deletePrinter, savePrinterAssignments,
    login, logout,
  ]);

  return <CassaContext.Provider value={value}>{children}</CassaContext.Provider>;
}