/**
 * Unified thermal-printer service.
 * Uses @delicity/capacitor-thermal-printer when running inside Capacitor.
 * Keeps the legacy AndroidPrinter bridge as a fallback during migration.
 */

let plugin = null;

function getPlugin() {
  if (plugin) return plugin;
  try {
    // Capacitor plugins exposed through the web runtime are available from the
    // global Capacitor registry. This avoids requiring a bundler in the current
    // single-file webapp.
    const cap = window.Capacitor;
    if (cap?.Plugins?.ThermalPrinter) {
      plugin = cap.Plugins.ThermalPrinter;
      return plugin;
    }
  } catch (e) {
    console.warn('[PrinterService] ThermalPrinter plugin unavailable', e);
  }
  return null;
}

export const PrinterService = {
  isNative() {
    return !!window.Capacitor?.isNativePlatform?.();
  },

  isAvailable() {
    return !!getPlugin() || typeof window.AndroidPrinter !== 'undefined';
  },

  async print(options) {
    const p = getPlugin();
    if (p) {
      // Adapter point for the plugin API. Keep all plugin-specific calls here
      // so the rest of the webapp does not depend on native implementation details.
      if (typeof p.printText === 'function' && options.text) {
        return p.printText({ text: options.text });
      }
      if (typeof p.printImage === 'function' && options.image) {
        return p.printImage({ image: options.image });
      }
      throw new Error('ThermalPrinter plugin trovato, ma nessun metodo di stampa compatibile è disponibile.');
    }

    if (window.AndroidPrinter?.print) {
      return window.AndroidPrinter.print(
        options.ticketNumber ?? '',
        options.category ?? '',
        options.content ?? options.text ?? '',
        options.copies ?? 1
      );
    }

    throw new Error('Nessun servizio di stampa disponibile.');
  },

  async test(printerId) {
    if (window.AndroidPrinter?.testPrintPrinter && printerId) {
      return window.AndroidPrinter.testPrintPrinter(printerId);
    }

    const p = getPlugin();
    if (p?.printText) {
      return p.printText({ text: '\n\n*** TEST STAMPANTE ***\nTabby\n\n' });
    }

    throw new Error('Servizio di stampa non disponibile.');
  }
};

if (typeof window !== 'undefined') window.PrinterService = PrinterService;
