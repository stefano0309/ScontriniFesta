package it.talloncinicassa.app.print;

import android.content.Context;
import android.content.SharedPreferences;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Gestore centralizzato per le stampanti.
 * Carica/salva configurazioni, crea connessioni, gestisce la coda.
 */
public class PrinterManager {
    private static final String PREFS_NAME = "cassa_printers";
    private static final String PREF_PRINTER_PREFIX = "printer_";
    private static final String PREF_CATEGORY_PRINTER = "category_printer_";
    private static final String PREF_CATEGORY_COPIES = "category_copies_";
    private static final String PREF_CATEGORY_ENABLED = "category_enabled_";

    private final Context context;
    private final PrintLogger logger = PrintLogger.getInstance();
    private final SharedPreferences prefs;

    private final Map<String, PrinterConfig> printers = new HashMap<>();
    private final PrintQueue printQueue;

    public PrinterManager(Context context) {
        this.context = context.getApplicationContext();
        this.prefs = this.context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.printQueue = new PrintQueue(context, this);
        loadPrinters();
    }

    /**
     * Carica tutte le stampanti dal storage locale.
     */
    private void loadPrinters() {
        printers.clear();
        for (String key : prefs.getAll().keySet()) {
            if (key.startsWith(PREF_PRINTER_PREFIX)) {
                String printerId = key.substring(PREF_PRINTER_PREFIX.length());
                PrinterConfig config = loadPrinter(printerId);
                if (config != null) {
                    printers.put(config.id, config);
                }
            }
        }
        logger.i("PrinterMgr", "Caricate " + printers.size() + " stampanti");
    }

    /**
     * Carica una singola stampante.
     */
    private PrinterConfig loadPrinter(String printerId) {
        // Implementazione semplificata: in produzione useremmo JSON
        // Per ora leggiamo i campi principali
        String prefKey = PREF_PRINTER_PREFIX + printerId;
        String jsonOrName = prefs.getString(prefKey, null);
        
        if (jsonOrName == null) return null;

        // Parsing semplice (in produzione useremmo Gson)
        // Per demo: salviamo come stringa separata da |
        String[] parts = jsonOrName.split("\\|");
        if (parts.length < 3) return null;

        PrinterConfig config = new PrinterConfig(printerId, parts[0], parts[1]);
        config.enabled = Boolean.parseBoolean(parts[2]);

        if ("bluetooth".equals(config.type) && parts.length > 3) {
            config.bluetoothAddress = parts[3];
            if (parts.length > 4) config.bluetoothName = parts[4];
        } else if ("network".equals(config.type) && parts.length > 3) {
            config.networkAddress = parts[3];
            if (parts.length > 4) config.networkPort = Integer.parseInt(parts[4]);
        }

        return config;
    }

    /**
     * Salva una stampante.
     */
    public void savePrinter(PrinterConfig config) {
        StringBuilder sb = new StringBuilder();
        sb.append(config.name).append("|")
          .append(config.type).append("|")
          .append(config.enabled);

        if ("bluetooth".equals(config.type)) {
            sb.append("|").append(config.bluetoothAddress);
            sb.append("|").append(config.bluetoothName);
        } else if ("network".equals(config.type)) {
            sb.append("|").append(config.networkAddress);
            sb.append("|").append(config.networkPort);
        }

        prefs.edit()
            .putString(PREF_PRINTER_PREFIX + config.id, sb.toString())
            .apply();

        printers.put(config.id, config);
        logger.i("PrinterMgr", "Stampante salvata: " + config.name);
    }

    /**
     * Elimina una stampante.
     */
    public void deletePrinter(String printerId) {
        prefs.edit().remove(PREF_PRINTER_PREFIX + printerId).apply();
        printers.remove(printerId);
        logger.i("PrinterMgr", "Stampante eliminata: " + printerId);
    }

    /**
     * Ritorna una stampante per ID.
     */
    public PrinterConfig getPrinter(String printerId) {
        return printers.get(printerId);
    }

    /**
     * Ritorna tutte le stampanti.
     */
    public List<PrinterConfig> getAllPrinters() {
        return new ArrayList<>(printers.values());
    }

    /**
     * Crea una nuova stampante.
     */
    public PrinterConfig createPrinter(String name, String type) {
        PrinterConfig config = new PrinterConfig(UUID.randomUUID().toString(), name, type);
        savePrinter(config);
        return config;
    }

    /**
     * Ritorna la stampante associata a una categoria.
     */
    public PrinterConfig getPrinterForCategory(String category) {
        String printerId = prefs.getString(PREF_CATEGORY_PRINTER + category, null);
        if (printerId != null) {
            return getPrinter(printerId);
        }
        return null;
    }

    /**
     * Associa una stampante a una categoria.
     */
    public void setPrinterForCategory(String category, String printerId) {
        prefs.edit()
            .putString(PREF_CATEGORY_PRINTER + category, printerId)
            .apply();
        logger.i("PrinterMgr", "Stampante assegnata a categoria: " + category);
    }

    /**
     * Ritorna il numero di copie predefinito per una categoria.
     */
    public int getCopiesForCategory(String category) {
        return prefs.getInt(PREF_CATEGORY_COPIES + category, 1);
    }

    /**
     * Imposta il numero di copie predefinito per una categoria.
     */
    public void setCopiesForCategory(String category, int copies) {
        prefs.edit()
            .putInt(PREF_CATEGORY_COPIES + category, Math.max(1, copies))
            .apply();
    }

    /**
     * Verifica se la stampa è abilitata per una categoria.
     */
    public boolean isCategoryEnabled(String category) {
        return prefs.getBoolean(PREF_CATEGORY_ENABLED + category, true);
    }

    /**
     * Abilita/disabilita la stampa per una categoria.
     */
    public void setCategoryEnabled(String category, boolean enabled) {
        prefs.edit()
            .putBoolean(PREF_CATEGORY_ENABLED + category, enabled)
            .apply();
    }

    /**
     * Crea una connessione in base al tipo di stampante.
     */
    public PrinterConnection createConnection(PrinterConfig config) {
        if (config == null) return null;

        switch (config.type) {
            case "bluetooth":
                return new BluetoothPrinterConnection(context, config);
            case "network":
                return new NetworkPrinterConnection(config);
            case "usb":
                return new UsbPrinterConnection(context, config);
            default:
                return null;
        }
    }

    /**
     * Aggiunge un job di stampa alla coda.
     */
    public void print(int ticketNumber, String category, String printerName,
                      String content, int copies) {
        PrintJob job = new PrintJob(ticketNumber, category, printerName, content, copies);
        printQueue.enqueue(job);
    }

    /**
     * Ritorna la coda di stampa.
     */
    public PrintQueue getQueue() {
        return printQueue;
    }

    /**
     * Arresta il manager e la coda.
     */
    public void stop() {
        printQueue.stop();
    }
}
