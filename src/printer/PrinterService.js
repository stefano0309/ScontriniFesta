/**
 * Unified thermal-printer service.
 * The concrete Capacitor bridge is exposed by www/printers-ui.js as
 * window.ThermalPrinter. AndroidPrinter remains a compatibility fallback.
 */

function getPlugin() {
  try {
    if (window.ThermalPrinter) return window.ThermalPrinter;
    if (window.PrintersModule?.getPlugin) return window.PrintersModule.getPlugin();
  } catch (e) {
    console.warn('[PrinterService] ThermalPrinter unavailable', e);
  }
  return null;
}

export const PrinterService = {
  isNative() {
    return !!window.Capacitor?.isNativePlatform?.();
  },

  isAvailable() {
    return !!getPlugin() || !!window.AndroidPrinter;
  },

  async print(options = {}) {
    const p = getPlugin();
    if (p?.printText && options.items) {
      return p.printText({
        printerId: options.printerId,
        items: options.items,
        encoding: options.encoding || 'WPC1252',
        paperWidthMm: options.paperWidthMm,
        timeoutMs: options.timeoutMs || 15000,
        autoReconnect: options.autoReconnect !== false
      });
    }

    if (p?.printText && options.text) {
      return p.printText({
        printerId: options.printerId,
        items: [{ type: 'text', value: String(options.text) }],
        encoding: options.encoding || 'WPC1252',
        autoReconnect: options.autoReconnect !== false
      });
    }

    if (p?.printImage && options.image) {
      return p.printImage({
        printerId: options.printerId,
        image: options.image,
        render: options.render,
        timeoutMs: options.timeoutMs || 15000,
        autoReconnect: options.autoReconnect !== false
      });
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
    if (window.PrintersModule?.testPrint) {
      return window.PrintersModule.testPrint(printerId);
    }

    if (window.AndroidPrinter?.testPrintPrinter && printerId) {
      return window.AndroidPrinter.testPrintPrinter(printerId);
    }

    throw new Error('Servizio di stampa non disponibile.');
  }
};

if (typeof window !== 'undefined') window.PrinterService = PrinterService;
