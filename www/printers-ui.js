/*
 * Tabby - thermal printers
 * Real bridge for @delicity/capacitor-thermal-printer.
 *
 * This file is intentionally plain JS because www/index.html is currently a
 * static page. The native Capacitor plugin is registered through the same
 * Capacitor bridge used by the npm package, so no bundler is required here.
 */
(function () {
  'use strict';

  const STORAGE_KEY = 'talloncini-cassa:printer-profiles';
  const ASSIGNMENTS_KEY = 'talloncini-cassa:printer-category-assignments';
  let thermalPrinter = null;
  let printers = [];
  let initialized = false;
  let discoverySubscription = null;
  let statusSubscription = null;

  function log(...args) { console.log('[PrintersModule]', ...args); }
  function warn(...args) { console.warn('[PrintersModule]', ...args); }

  function getCapacitor() {
    return window.Capacitor || null;
  }

  function getThermalPrinter() {
    if (thermalPrinter) return thermalPrinter;
    const cap = getCapacitor();
    if (!cap || typeof cap.registerPlugin !== 'function') {
      return null;
    }
    // Equivalent to the package's public index.ts registration. The native
    // plugin is registered under this exact name by the Android implementation.
    thermalPrinter = cap.registerPlugin('ThermalPrinter');
    return thermalPrinter;
  }

  function isNative() {
    const cap = getCapacitor();
    return !!cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform();
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      warn('localStorage read failed', key, e);
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (e) {
      warn('localStorage write failed', key, e);
      return false;
    }
  }

  function getSavedProfiles() {
    const p = readJson(STORAGE_KEY, []);
    return Array.isArray(p) ? p : [];
  }

  function getAssignments() {
    const a = readJson(ASSIGNMENTS_KEY, {});
    return a && typeof a === 'object' ? a : {};
  }

  function saveAssignment(category, printerId) {
    const assignments = getAssignments();
    if (printerId) assignments[category] = printerId;
    else delete assignments[category];
    writeJson(ASSIGNMENTS_KEY, assignments);
    if (window.settings) {
      window.settings.categoryPrinters = assignments;
      try { window.safeSet?.('app-settings', window.settings); } catch (_) {}
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[c]));
  }

  function notify(message, error) {
    if (typeof window.flash === 'function') window.flash(message, !!error);
    else if (error) console.error(message);
    else console.log(message);
  }

  function mergePrinters(discovered, saved) {
    const map = new Map();
    [...saved, ...discovered].forEach(p => {
      if (!p || !p.id) return;
      map.set(p.id, { ...map.get(p.id), ...p });
    });
    return Array.from(map.values());
  }

  function rememberPrinter(printer) {
    if (!printer?.id) return;
    const profiles = getSavedProfiles();
    const idx = profiles.findIndex(p => p.id === printer.id);
    const profile = {
      id: printer.id,
      name: printer.name || printer.id,
      transport: printer.transport || '',
      adapter: printer.adapter || 'escpos',
      address: printer.address || '',
      brand: printer.brand || '',
      model: printer.model || '',
      capabilities: printer.capabilities || {}
    };
    if (idx >= 0) profiles[idx] = { ...profiles[idx], ...profile };
    else profiles.push(profile);
    writeJson(STORAGE_KEY, profiles);
  }

  function forgetPrinter(printerId) {
    writeJson(STORAGE_KEY, getSavedProfiles().filter(p => p.id !== printerId));
    const assignments = getAssignments();
    Object.keys(assignments).forEach(cat => {
      if (assignments[cat] === printerId) delete assignments[cat];
    });
    writeJson(ASSIGNMENTS_KEY, assignments);
  }

  function printerLabel(p) {
    const transport = p.transport ? ` · ${p.transport}` : '';
    return `${p.name || p.id}${transport}`;
  }

  async function requestPermissions() {
    const p = getThermalPrinter();
    if (!p?.requestPermissions) return { bluetooth: 'unavailable' };
    return p.requestPermissions();
  }

  async function discover(timeoutMs = 8000) {
    const p = getThermalPrinter();
    if (!p) throw new Error('Capacitor non disponibile. Apri l\'app Android/iOS, non il file HTML nel browser.');
    if (!isNative()) throw new Error('La ricerca stampanti funziona nella build Capacitor nativa.');

    await requestPermissions();

    const saved = getSavedProfiles();
    const found = [];

    if (p.addListener) {
      try {
        if (discoverySubscription?.remove) await discoverySubscription.remove();
        discoverySubscription = await p.addListener('printerFound', event => {
          const printer = event?.printer;
          if (!printer?.id) return;
          const idx = found.findIndex(x => x.id === printer.id);
          if (idx >= 0) found[idx] = { ...found[idx], ...printer };
          else found.push(printer);
          printers = mergePrinters(found, saved);
          renderPrinters();
        });
      } catch (e) { warn('printerFound listener failed', e); }
    }

    const result = await p.discoverPrinters({ timeoutMs });
    const discovered = Array.isArray(result?.printers) ? result.printers : [];
    printers = mergePrinters(discovered, saved);
    printers.forEach(rememberPrinter);
    renderPrinters();
    return printers;
  }

  async function connect(printerId, setAsDefault = false) {
    const p = getThermalPrinter();
    if (!p?.connectPrinter) throw new Error('API connectPrinter non disponibile.');
    const result = await p.connectPrinter({ printerId, setAsDefault });
    if (!result?.connected) throw new Error('La stampante non risponde.');
    const printer = printers.find(x => x.id === printerId);
    if (printer) rememberPrinter({ ...printer, paper: result.paper || null });
    return result;
  }

  async function disconnect(printerId) {
    const p = getThermalPrinter();
    if (p?.disconnectPrinter) await p.disconnectPrinter({ printerId });
  }

  async function testPrint(printerId) {
    const p = getThermalPrinter();
    if (!p?.printText) throw new Error('API printText non disponibile.');
    await connect(printerId, true);
    return p.printText({
      printerId,
      encoding: 'WPC1252',
      items: [
        { type: 'text', value: 'TABBY', style: { align: 'center', bold: true, widthMultiplier: 2, heightMultiplier: 2 } },
        { type: 'divider', char: '-' },
        { type: 'text', value: 'TEST STAMPANTE', style: { align: 'center', bold: true } },
        { type: 'text', value: new Date().toLocaleString('it-IT'), style: { align: 'center' } },
        { type: 'text', value: 'Bluetooth / LAN / USB', style: { align: 'center' } },
        { type: 'feed', lines: 2 },
        { type: 'cut', mode: 'partial', feedBefore: 2 }
      ],
      autoReconnect: true
    });
  }

  async function printText(printerId, items, options = {}) {
    const p = getThermalPrinter();
    if (!p?.printText) throw new Error('API printText non disponibile.');
    const copies = Math.max(1, Number(options.copies) || 1);
    let result;
    for (let i = 0; i < copies; i++) {
      result = await p.printText({
        printerId,
        items,
        encoding: options.encoding || 'WPC1252',
        paperWidthMm: options.paperWidthMm,
        timeoutMs: options.timeoutMs || 15000,
        autoReconnect: options.autoReconnect !== false,
        cut: options.cut === true,
        feedLines: options.feedLines ?? 3
      });
    }
    return result;
  }

  async function printReceipt({ printerId, ticketNumber, title, lines, total, copies = 1, openCashDrawer = false, paperWidthMm = 58 }) {
    const items = [
      { type: 'text', value: title || 'ORDINE', style: { align: 'center', bold: true, widthMultiplier: 2, heightMultiplier: 2 } },
      { type: 'text', value: `Scontrino #${ticketNumber || ''}`, style: { align: 'center', bold: true } },
      { type: 'divider', char: '-' }
    ];
    (lines || []).forEach(line => {
      const qty = Number(line.qty) || 1;
      const price = Number(line.price) || 0;
      items.push({ type: 'text', value: `${qty} x ${line.name || ''}  ${price.toFixed(2)} €` });
      if (line.note) items.push({ type: 'text', value: `  - ${line.note}` });
    });
    items.push({ type: 'divider', char: '-' });
    items.push({ type: 'text', value: `TOTALE  ${Number(total || 0).toFixed(2)} €`, style: { align: 'right', bold: true, widthMultiplier: 2, heightMultiplier: 2 } });
    if (openCashDrawer) items.push({ type: 'cashDrawer', pin: 2 });
    items.push({ type: 'feed', lines: 2 });
    items.push({ type: 'cut', mode: 'partial', feedBefore: 2 });
    return printText(printerId, items, { copies, paperWidthMm });
  }

  async function status(printerId) {
    const p = getThermalPrinter();
    if (!p?.getPrinterStatus) return null;
    return p.getPrinterStatus(printerId ? { printerId } : {});
  }

  async function setDefault(printerId) {
    const p = getThermalPrinter();
    if (!p?.setDefaultPrinter) throw new Error('API setDefaultPrinter non disponibile.');
    return p.setDefaultPrinter({ printerId });
  }

  async function remove(printerId) {
    const p = getThermalPrinter();
    if (p?.removePrinter) await p.removePrinter({ printerId });
    forgetPrinter(printerId);
    printers = printers.filter(x => x.id !== printerId);
    renderPrinters();
  }

  function renderPrinters() {
    const container = document.getElementById('printersListContainer');
    if (!container) return;
    const assignments = getAssignments();
    if (!printers.length) {
      container.innerHTML = '<div class="empty-hint">Nessuna stampante. Premi “Aggiungi stampante” per cercarla.</div>';
      renderAssignments();
      return;
    }
    container.innerHTML = printers.map(p => {
      const assigned = Object.keys(assignments).filter(c => assignments[c] === p.id).length;
      return `<div style="border:1px solid var(--line);border-radius:8px;padding:12px;margin-bottom:10px;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap;">
        <div style="min-width:220px;flex:1;">
          <b>${escapeHtml(p.name || p.id)}</b>
          <div style="font-size:11px;color:var(--text-dim);margin-top:3px;">${escapeHtml(p.transport || '—')} · ${escapeHtml(p.address || p.id)}${p.model ? ' · ' + escapeHtml(p.model) : ''}</div>
          <div style="font-size:11px;color:var(--text-dim);margin-top:3px;">Categorie associate: ${assigned}</div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button type="button" class="btn-teal printer-test" data-id="${escapeHtml(p.id)}">Test</button>
          <button type="button" class="btn-amber printer-default" data-id="${escapeHtml(p.id)}">Predefinita</button>
          <button type="button" class="btn-red printer-remove" data-id="${escapeHtml(p.id)}">Rimuovi</button>
        </div>
      </div>`;
    }).join('');

    container.querySelectorAll('.printer-test').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await testPrint(btn.dataset.id); notify('Test stampato'); }
      catch (e) { console.error(e); notify('Test fallito: ' + (e?.message || e), true); }
      finally { btn.disabled = false; }
    });
    container.querySelectorAll('.printer-default').forEach(btn => btn.onclick = async () => {
      try { await setDefault(btn.dataset.id); notify('Stampante predefinita salvata'); }
      catch (e) { notify('Impossibile impostare la predefinita: ' + (e?.message || e), true); }
    });
    container.querySelectorAll('.printer-remove').forEach(btn => btn.onclick = async () => {
      if (!confirm('Rimuovere questa stampante dalla configurazione?')) return;
      try { await remove(btn.dataset.id); notify('Stampante rimossa'); }
      catch (e) { notify('Impossibile rimuovere la stampante: ' + (e?.message || e), true); }
    });
    renderAssignments();
  }

  function renderAssignments() {
    const container = document.getElementById('categoryAssignmentsContainer');
    if (!container) return;
    const menu = Array.isArray(window.menu) ? window.menu : [];
    const categories = [...new Set(menu.map(d => (d.cat || 'Senza categoria').trim() || 'Senza categoria'))].sort();
    const assignments = getAssignments();
    if (!categories.length) {
      container.innerHTML = '<div class="empty-hint">Aggiungi piatti al menu per configurare le categorie.</div>';
      return;
    }
    container.innerHTML = categories.map(cat => {
      const current = assignments[cat] || '';
      return `<div style="display:grid;grid-template-columns:1fr minmax(180px,300px);gap:10px;align-items:center;border-bottom:1px solid var(--line);padding:10px 0;">
        <span>${escapeHtml(cat)}</span>
        <select class="printer-assignment" data-category="${escapeHtml(cat)}" style="margin:0;">
          <option value="">Nessuna / default</option>
          ${printers.map(p => `<option value="${escapeHtml(p.id)}" ${current === p.id ? 'selected' : ''}>${escapeHtml(printerLabel(p))}</option>`).join('')}
        </select>
      </div>`;
    }).join('');
    container.querySelectorAll('.printer-assignment').forEach(select => {
      select.addEventListener('change', () => {
        saveAssignment(select.dataset.category, select.value);
        notify('Associazione categoria salvata');
        renderPrinters();
      });
    });
  }

  function addPrinterModal() {
    let modal = document.getElementById('printerDiscoveryModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'printerDiscoveryModal';
      modal.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:18px;';
      modal.innerHTML = `<div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:12px;">
          <h2 style="margin:0;color:var(--amber);font-family:Oswald,sans-serif;text-transform:uppercase;font-size:17px;">Aggiungi stampante</h2>
          <button type="button" id="printerModalClose" class="btn-outline">Chiudi</button>
        </div>
        <p id="printerDiscoveryStatus" class="hint">Cerca stampanti Bluetooth, LAN/Wi-Fi e USB disponibili.</p>
        <button type="button" id="printerDiscoverBtn" class="btn-teal btn-block">🔎 Cerca stampanti</button>
        <div id="printerDiscoveryResults" style="margin-top:14px;"></div>
      </div>`;
      document.body.appendChild(modal);
      modal.querySelector('#printerModalClose').onclick = () => modal.remove();
      modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
      modal.querySelector('#printerDiscoverBtn').onclick = async () => {
        const btn = modal.querySelector('#printerDiscoverBtn');
        const status = modal.querySelector('#printerDiscoveryStatus');
        btn.disabled = true;
        status.textContent = 'Richiesta permessi e ricerca in corso…';
        try {
          const list = await discover(8000);
          status.textContent = list.length ? `${list.length} stampante/i trovata/e.` : 'Nessuna stampante trovata. Controlla che sia accesa e collegata alla stessa rete o associata via Bluetooth.';
          renderDiscoveryResults(modal, list);
        } catch (e) {
          console.error(e);
          status.textContent = e?.message || String(e);
          renderDiscoveryResults(modal, []);
        } finally { btn.disabled = false; }
      };
    }
  }

  function renderDiscoveryResults(modal, list) {
    const el = modal.querySelector('#printerDiscoveryResults');
    if (!list.length) { el.innerHTML = '<div class="empty-hint">Nessun risultato.</div>'; return; }
    el.innerHTML = list.map(p => `<div style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center;">
      <div><b>${escapeHtml(p.name || p.id)}</b><div style="font-size:11px;color:var(--text-dim);">${escapeHtml(p.transport || '')} · ${escapeHtml(p.address || p.id)}</div></div>
      <button type="button" class="btn-amber printer-add-result" data-id="${escapeHtml(p.id)}">Usa questa</button>
    </div>`).join('');
    el.querySelectorAll('.printer-add-result').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try {
        await connect(btn.dataset.id, true);
        const printer = printers.find(p => p.id === btn.dataset.id);
        if (printer) rememberPrinter(printer);
        renderPrinters();
        notify('Stampante collegata e impostata come predefinita');
        modal.remove();
      } catch (e) {
        notify('Connessione fallita: ' + (e?.message || e), true);
        btn.disabled = false;
      }
    });
  }

  async function init() {
    if (initialized) {
      renderPrinters();
      return;
    }
    initialized = true;
    const saved = getSavedProfiles();
    printers = saved.slice();
    renderPrinters();

    const p = getThermalPrinter();
    if (!p) {
      warn('Capacitor non disponibile in questa pagina');
      return;
    }
    try {
      await requestPermissions();
    } catch (e) { warn('Permission request failed', e); }

    if (p.addListener) {
      try {
        statusSubscription = await p.addListener('statusChange', event => {
          const s = event?.status;
          if (s?.printerId) {
            const printer = printers.find(x => x.id === s.printerId);
            if (printer) printer.status = s;
            renderPrinters();
          }
        });
      } catch (e) { warn('statusChange listener failed', e); }
    }
  }

  window.PrintersModule = {
    init,
    addPrinterModal,
    addPrinter: addPrinterModal,
    discover,
    getPrinters: () => printers.slice(),
    getSavedPrinters: getSavedProfiles,
    getAssignments,
    saveAssignment,
    connect,
    disconnect,
    testPrint,
    printText,
    printReceipt,
    status,
    setDefault,
    remove,
    requestPermissions,
    getPlugin: getThermalPrinter,
    isNative,
    render: renderPrinters
  };

  // Used by PrinterService and by the rest of the app.
  window.ThermalPrinter = getThermalPrinter();
  log('module loaded; native=', isNative(), 'plugin=', !!window.ThermalPrinter);
})();
