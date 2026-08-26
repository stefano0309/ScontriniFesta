const STORAGE_KEY = 'talloncini-cassa:printer-profiles';
const ASSIGNMENTS_KEY = 'talloncini-cassa:printer-category-assignments';

let thermalPrinter = null;
let printers = [];
let initialized = false;
let discoverySubscription = null;
let statusSubscription = null;

const log = (...args) => console.log('[PrintersModule]', ...args);
const warn = (...args) => console.warn('[PrintersModule]', ...args);
const cap = () => (typeof window !== 'undefined' ? window.Capacitor || null : null);

const notifyChanged = () => {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('printers:changed'));
  }
};

function readJson(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    warn('localStorage read', error);
    return fallback;
  }
}

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    warn('localStorage write', error);
    return false;
  }
}

export function getThermalPrinter() {
  if (thermalPrinter) return thermalPrinter;
  const c = cap();
  if (!c) return null;
  thermalPrinter = c.Plugins?.ThermalPrinter || null;
  if (!thermalPrinter && typeof c.registerPlugin === 'function') {
    thermalPrinter = c.registerPlugin('ThermalPrinter');
  }
  return thermalPrinter;
}

export function isNative() {
  const c = cap();
  return !!c && (typeof c.isNativePlatform !== 'function' || c.isNativePlatform());
}

export function getSavedPrinters() {
  const saved = readJson(STORAGE_KEY, []);
  return Array.isArray(saved) ? saved : [];
}

export function getAssignments() {
  const saved = readJson(ASSIGNMENTS_KEY, {});
  return saved && typeof saved === 'object' ? saved : {};
}

function rememberPrinter(profile) {
  if (!profile?.id) return;
  const list = getSavedPrinters();
  const next = { id: profile.id, name: profile.name || profile.id, transport: profile.transport || '', address: profile.address || '', brand: profile.brand || '', model: profile.model || '', capabilities: profile.capabilities || {} };
  const index = list.findIndex((item) => item.id === profile.id);
  if (index >= 0) list[index] = { ...list[index], ...next };
  else list.push(next);
  writeJson(STORAGE_KEY, list);
  printers = list;
  notifyChanged();
}

function merge(a, b) {
  const map = new Map();
  [...a, ...b].forEach((p) => {
    if (p?.id) map.set(p.id, { ...(map.get(p.id) || {}), ...p });
  });
  return [...map.values()];
}

export async function checkPermissions() {
  const p = getThermalPrinter();
  if (!p) throw new Error('ThermalPrinter non esposto dal bridge Capacitor.');
  const result = p.checkPermissions ? await p.checkPermissions() : null;
  log('permission state:', result);
  return result;
}

export async function requestPermissions() {
  const p = getThermalPrinter();
  if (!p) throw new Error('ThermalPrinter non esposto dal bridge Capacitor.');
  if (!p.requestPermissions) throw new Error('Il plugin non espone requestPermissions().');
  const result = await p.requestPermissions();
  log('permission request result:', result);
  return result;
}

export async function discover(timeoutMs = 10000) {
  const p = getThermalPrinter();
  if (!p) throw new Error('Plugin ThermalPrinter non disponibile nel bridge Android.');
  if (!isNative()) throw new Error("Apri l'app Android Capacitor per cercare stampanti.");

  const old = getSavedPrinters();
  const found = [];

  if (p.addListener) {
    try {
      if (discoverySubscription?.remove) await discoverySubscription.remove();
      discoverySubscription = await p.addListener('printerFound', (event) => {
        if (!event?.printer?.id) return;
        const index = found.findIndex((printer) => printer.id === event.printer.id);
        if (index >= 0) found[index] = { ...found[index], ...event.printer };
        else found.push(event.printer);
        printers = merge(found, old);
        notifyChanged();
      });
    } catch (error) {
      warn('printerFound listener', error);
    }
  }

  const result = await p.discoverPrinters({ timeoutMs });
  const discovered = Array.isArray(result?.printers) ? result.printers : [];
  printers = merge(discovered, old);
  printers.forEach((printer) => rememberPrinter(printer));
  notifyChanged();
  log('discoverPrinters:', result);
  return printers;
}

export async function connect(printerId, setAsDefault = false) {
  const p = getThermalPrinter();
  if (!p?.connectPrinter) throw new Error('connectPrinter() non disponibile.');
  const result = await p.connectPrinter({ printerId, setAsDefault });
  if (!result?.connected) throw new Error('Connessione alla stampante fallita.');
  return result;
}

export async function testPrint(printerId) {
  const p = getThermalPrinter();
  if (!p?.printText) throw new Error('printText() non disponibile.');
  await connect(printerId, true);
  return p.printText({
    printerId,
    encoding: 'WPC1252',
    items: [
      { type: 'text', value: 'TABBY', style: { align: 'center', bold: true, widthMultiplier: 2, heightMultiplier: 2 } },
      { type: 'divider', char: '-' },
      { type: 'text', value: 'TEST STAMPANTE', style: { align: 'center', bold: true } },
      { type: 'text', value: new Date().toLocaleString('it-IT'), style: { align: 'center' } },
      { type: 'feed', lines: 2 },
      { type: 'cut', mode: 'partial', feedBefore: 2 },
    ],
    autoReconnect: true,
  });
}

export async function printText(printerId, items, options = {}) {
  const p = getThermalPrinter();
  if (!p?.printText) throw new Error('printText() non disponibile.');
  let result;
  for (let i = 0; i < Math.max(1, Number(options.copies) || 1); i += 1) {
    result = await p.printText({
      printerId,
      items,
      encoding: options.encoding || 'WPC1252',
      paperWidthMm: options.paperWidthMm,
      timeoutMs: options.timeoutMs || 15000,
      autoReconnect: options.autoReconnect !== false,
      cut: options.cut === true,
      feedLines: options.feedLines ?? 3,
    });
  }
  return result;
}

export async function setDefault(printerId) {
  const p = getThermalPrinter();
  if (!p?.setDefaultPrinter) throw new Error('setDefaultPrinter() non disponibile.');
  return p.setDefaultPrinter({ printerId });
}

export async function disconnect(printerId) {
  const p = getThermalPrinter();
  if (p?.disconnectPrinter) return p.disconnectPrinter({ printerId });
  return null;
}

export async function status(printerId) {
  const p = getThermalPrinter();
  return p?.getPrinterStatus ? p.getPrinterStatus(printerId ? { printerId } : {}) : null;
}

export async function remove(printerId) {
  const p = getThermalPrinter();
  if (p?.removePrinter) await p.removePrinter({ printerId });
  const next = getSavedPrinters().filter((item) => item.id !== printerId);
  writeJson(STORAGE_KEY, next);
  printers = printers.filter((item) => item.id !== printerId);
  notifyChanged();
  return next;
}

export function saveAssignment(category, printerId) {
  const assignmentState = getAssignments();
  if (printerId) assignmentState[category] = printerId;
  else delete assignmentState[category];
  writeJson(ASSIGNMENTS_KEY, assignmentState);
  notifyChanged();
  return assignmentState;
}

export function addPrinterModal() {
  if (typeof document === 'undefined') return null;
  let modal = document.getElementById('printerDiscoveryModal');
  if (modal) return modal;

  modal = document.createElement('div');
  modal.id = 'printerDiscoveryModal';
  modal.style.cssText = 'position:fixed;inset:0;z-index:20000;background:rgba(0,0,0,.65);display:flex;align-items:center;justify-content:center;padding:18px';
  modal.innerHTML = '<div style="width:min(620px,100%);max-height:90vh;overflow:auto;background:var(--panel);color:var(--text);border:1px solid var(--line);border-radius:12px;padding:18px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2 style="margin:0;color:var(--amber)">Aggiungi stampante</h2><button id="printerModalClose" class="btn-outline">Chiudi</button></div><p id="printerDiscoveryStatus" class="hint">Controllo permessi Bluetooth e ricerca stampanti.</p><button id="printerDiscoverBtn" class="btn-teal btn-block">🔎 Cerca stampanti</button><div id="printerDiscoveryResults" style="margin-top:14px"></div></div>';

  document.body.appendChild(modal);
  modal.querySelector('#printerModalClose').onclick = () => modal.remove();
  modal.querySelector('#printerDiscoverBtn').onclick = async () => {
    const button = modal.querySelector('#printerDiscoverBtn');
    const status = modal.querySelector('#printerDiscoveryStatus');

    button.disabled = true;
    status.textContent = 'Controllo permessi Bluetooth…';

    try {
      const list = await discover(10000);
      status.textContent = list.length ? `${list.length} stampante/i trovata/e.` : 'Nessuna stampante trovata. Controlla Bluetooth e associazione della stampante.';
      const results = modal.querySelector('#printerDiscoveryResults');
      if (!list.length) {
        results.innerHTML = '<div class="empty-hint">Nessun risultato.</div>';
        return;
      }

      results.innerHTML = list
        .map(
          (printer) => `
            <div style="border:1px solid var(--line);border-radius:8px;padding:10px;margin-bottom:8px;display:flex;justify-content:space-between;gap:10px;align-items:center">
              <div>
                <b>${String(printer.name || printer.id)}</b>
                <div style="font-size:11px;color:var(--text-dim)">${String(printer.transport || '')} · ${String(printer.address || printer.id)}</div>
              </div>
              <button class="btn-amber printer-add-result" data-id="${String(printer.id)}">Usa questa</button>
            </div>
          `,
        )
        .join('');

      results.querySelectorAll('.printer-add-result').forEach((buttonElement) => {
        buttonElement.onclick = async () => {
          buttonElement.disabled = true;
          try {
            await connect(buttonElement.dataset.id, true);
            rememberPrinter(printers.find((printer) => printer.id === buttonElement.dataset.id));
            notifyChanged();
            modal.remove();
          } catch (error) {
            console.error('[PrintersModule]', error);
            buttonElement.disabled = false;
          }
        };
      });
    } catch (error) {
      console.error('[PrintersModule]', error);
      status.textContent = 'Errore: ' + (error?.message || error);
      modal.querySelector('#printerDiscoveryResults').innerHTML = '<div class="empty-hint">Nessun risultato.</div>';
    } finally {
      button.disabled = false;
    }
  };

  return modal;
}

export function initPrintersModule() {
  if (initialized) {
    notifyChanged();
    return window.PrintersModule;
  }

  initialized = true;
  printers = getSavedPrinters();

  const module = {
    init: initPrintersModule,
    addPrinterModal,
    addPrinter: addPrinterModal,
    discover,
    getPrinters: () => printers.slice(),
    getSavedPrinters: getSavedPrinters,
    getAssignments: getAssignments,
    saveAssignment,
    connect,
    disconnect,
    testPrint,
    printText,
    printReceipt: null,
    status,
    setDefault,
    remove,
    requestPermissions,
    checkPermissions,
    getPlugin: getThermalPrinter,
    isNative,
    render: () => notifyChanged(),
  };

  if (typeof window !== 'undefined') {
    window.PrintersModule = module;
    window.ThermalPrinter = getThermalPrinter();
    log('loaded; native=', isNative(), 'plugin=', !!window.ThermalPrinter, 'capacitor=', !!window.Capacitor);
  }

  return module;
}

if (typeof window !== 'undefined') {
  window.PrintersModule = window.PrintersModule || initPrintersModule();
  window.ThermalPrinter = getThermalPrinter();
}

export const PrintersModule = typeof window !== 'undefined' ? window.PrintersModule || initPrintersModule() : initPrintersModule();
