// printersBridge.js — lightweight scaffold to abstract native Android printer bridge
// If `window.PrintersModule` is provided by the Android WebView/bridge, calls
// are forwarded to it. Otherwise a web fallback is used for development.

const PrintersBridge = {
  isNative() {
    return typeof window.PrintersModule !== 'undefined';
  },

  async list() {
    if (this.isNative() && typeof window.PrintersModule.list === 'function') {
      try { return await window.PrintersModule.list(); } catch (e) { return []; }
    }
    return [];
  },

  addPrinterModal() {
    if (this.isNative() && typeof window.PrintersModule.addPrinterModal === 'function') {
      return window.PrintersModule.addPrinterModal();
    }
    // Web fallback: prompt user for basic details
    const name = window.prompt('Nome stampante:');
    if (!name) return null;
    const type = window.prompt('Tipo (bluetooth/lan/usb):', 'bluetooth') || 'bluetooth';
    const address = window.prompt('Indirizzo (MAC/IP):', '') || '';
    return { name, type, address };
  },

  async sendRawBase64(b64) {
    // Prefer native bridge; fallback to rawbt URL scheme (Android RawBT app)
    if (this.isNative() && typeof window.PrintersModule.sendRawBase64 === 'function') {
      return window.PrintersModule.sendRawBase64(b64);
    }
    // Fallback: open rawbt intent (may be intercepted on Android)
    try {
      window.location.href = 'rawbt:base64,' + b64;
      return { ok: true };
    } catch (e) {
      return { ok: false, error: String(e) };
    }
  },

  // Simple helper used by PrinterTab during development
  mockAddPrinter(printersStore, printer) {
    printersStore.push({ id: String(Date.now()), ...printer });
    return printersStore;
  },
};

export default PrintersBridge;
