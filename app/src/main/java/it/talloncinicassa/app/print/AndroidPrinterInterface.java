package it.talloncinicassa.app.print;

import android.content.Context;
import android.webkit.JavascriptInterface;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

/**
 * Bridge JavaScript ↔ Android per il sistema di stampa nativo.
 * Registrato nel WebView come "AndroidPrinter".
 */
public class AndroidPrinterInterface {

    private final PrinterManager printerManager;
    private final PrintLogger logger = PrintLogger.getInstance();
    private final Callback callback;

    public interface Callback {
        void onMessage(String message);
        void onError(String error);
    }

    public AndroidPrinterInterface(Context context, Callback callback) {
        this.printerManager = new PrinterManager(context);
        this.callback = callback;
        logger.i("AndroidPrinterInterface", "Interfaccia inizializzata");
    }

    /**
     * Elenca tutte le stampanti disponibili.
     * Formato JSON: [{"id":"...", "name":"...", "type":"...", "enabled":true}, ...]
     */
    @JavascriptInterface
    public String getPrinters() {
        try {
            StringBuilder json = new StringBuilder("[");
            List<PrinterConfig> printers = printerManager.getAllPrinters();
            for (int i = 0; i < printers.size(); i++) {
                PrinterConfig p = printers.get(i);
                if (i > 0) json.append(",");
                json.append("{")
                    .append("\"id\":\"").append(escapeJson(p.id)).append("\",")
                    .append("\"name\":\"").append(escapeJson(p.name)).append("\",")
                    .append("\"type\":\"").append(escapeJson(p.type)).append("\",")
                    .append("\"enabled\":").append(p.enabled)
                    .append("}");
            }
            json.append("]");
            return json.toString();
        } catch (Exception e) {
            logger.e("AndroidPrinter", "getPrinters error", e);
            return "[]";
        }
    }

    /**
     * Aggiunge una nuova stampante.
     * @param name Nome stampante
     * @param type "bluetooth", "network", "usb"
     * @param config JSON con dettagli specifici del tipo
     * @return ID stampante appena creata
     */
    @JavascriptInterface
    public String addPrinter(String name, String type, String config) {
        try {
            PrinterConfig printer = printerManager.createPrinter(name, type);
            
            // Parse config (formato semplice: chiave=valore,chiave=valore)
            if (config != null && !config.isEmpty()) {
                String[] pairs = config.split(",");
                for (String pair : pairs) {
                    String[] kv = pair.split("=");
                    if (kv.length == 2) {
                        String key = kv[0].trim();
                        String value = kv[1].trim();
                        
                        if ("bluetooth".equals(type)) {
                            if ("address".equals(key)) printer.bluetoothAddress = value;
                            if ("name".equals(key)) printer.bluetoothName = value;
                        } else if ("network".equals(type)) {
                            if ("address".equals(key)) printer.networkAddress = value;
                            if ("port".equals(key)) printer.networkPort = Integer.parseInt(value);
                            if ("timeout".equals(key)) printer.networkTimeoutMs = Integer.parseInt(value);
                        } else if ("usb".equals(type)) {
                            if ("vid".equals(key)) printer.usbVendorId = Integer.parseInt(value);
                            if ("pid".equals(key)) printer.usbProductId = Integer.parseInt(value);
                        }
                    }
                }
            }
            
            printerManager.savePrinter(printer);
            logger.i("AndroidPrinter", "Stampante aggiunta: " + name);
            return printer.id;
        } catch (Exception e) {
            logger.e("AndroidPrinter", "addPrinter error", e);
            if (callback != null) callback.onError("Errore nell'aggiungere la stampante: " + e.getMessage());
            return "";
        }
    }

    /**
     * Elimina una stampante.
     */
    @JavascriptInterface
    public void deletePrinter(String printerId) {
        try {
            printerManager.deletePrinter(printerId);
            logger.i("AndroidPrinter", "Stampante eliminata: " + printerId);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "deletePrinter error", e);
            if (callback != null) callback.onError("Errore nell'eliminare la stampante");
        }
    }

    /**
     * Stampa un ticket.
     * @param ticketNumber Numero dello scontrino
     * @param category Categoria (es. "Bar")
     * @param content Contenuto ticket (ESC/POS)
     * @param copies Numero di copie
     */
    @JavascriptInterface
    public void print(int ticketNumber, String category, String content, int copies) {
        try {
            PrinterConfig printer = printerManager.getPrinterForCategory(category);
            if (printer == null) {
                if (callback != null) {
                    callback.onError("Nessuna stampante assegnata per la categoria: " + category);
                }
                logger.w("AndroidPrinter", "Nessuna stampante per categoria: " + category);
                return;
            }

            if (!printer.isValid()) {
                if (callback != null) {
                    callback.onError("Stampante non configurata: " + printer.name);
                }
                logger.w("AndroidPrinter", "Stampante non valida: " + printer.name);
                return;
            }

            int finalCopies = copies > 0 ? copies : printerManager.getCopiesForCategory(category);
            printerManager.print(ticketNumber, category, printer.name, content, finalCopies);
            logger.i("AndroidPrinter", "Stampa accodata: ticket " + ticketNumber + ", categoria " + category);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "print error", e);
            if (callback != null) callback.onError("Errore di stampa: " + e.getMessage());
        }
    }

    /**
     * Test di stampa per una categoria.
     * Stampa un ticket di prova su tutte le stampanti della categoria.
     */
    @JavascriptInterface
    public void testPrint(String category) {
        try {
            PrinterConfig printer = printerManager.getPrinterForCategory(category);
            if (printer == null) {
                if (callback != null) {
                    callback.onError("Nessuna stampante assegnata per la categoria: " + category);
                }
                return;
            }

            // Genera ticket di prova
            EscPosPrinter escPos = new EscPosPrinter(printer);
            byte[] testData = escPos.initialize();
            String testContent = new String(testData) + "\n=== TEST DI STAMPA ===\n" +
                    "Stampante: " + printer.name + "\n" +
                    "Tipo: " + printer.type + "\n" +
                    "Data: " + new java.util.Date().toString() + "\n" +
                    "================\n\n";

            printerManager.print(9999, category, printer.name, testContent, 1);
            logger.i("AndroidPrinter", "Test di stampa avviato per categoria: " + category);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "testPrint error", e);
            if (callback != null) callback.onError("Errore nel test di stampa: " + e.getMessage());
        }
    }

    /**
     * Ritorna lo stato di una stampante.
     * Formato JSON: {"printer":"...", "status":"connected|disconnected|error", "message":"..."}
     */
    @JavascriptInterface
    public String getPrinterStatus(String printerId) {
        try {
            PrinterConfig printer = printerManager.getPrinter(printerId);
            if (printer == null) {
                return "{\"status\":\"not_found\"}";
            }

            String status = "disconnected";
            String message = "";

            try {
                PrinterConnection conn = printerManager.createConnection(printer);
                if (conn != null) {
                    if (conn.testConnection()) {
                        status = "connected";
                    }
                    conn.close();
                }
            } catch (IOException e) {
                status = "error";
                message = e.getMessage();
            }

            return "{" +
                    "\"printer\":\"" + escapeJson(printer.name) + "\"," +
                    "\"type\":\"" + escapeJson(printer.type) + "\"," +
                    "\"status\":\"" + status + "\"," +
                    "\"message\":\"" + escapeJson(message) + "\"" +
                    "}";
        } catch (Exception e) {
            logger.e("AndroidPrinter", "getPrinterStatus error", e);
            return "{\"status\":\"error\",\"message\":\"" + escapeJson(e.getMessage()) + "\"}";
        }
    }

    /**
     * Associa una stampante a una categoria.
     */
    @JavascriptInterface
    public void setPrinterForCategory(String category, String printerId) {
        try {
            printerManager.setPrinterForCategory(category, printerId);
            logger.i("AndroidPrinter", "Stampante associata a categoria: " + category);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "setPrinterForCategory error", e);
        }
    }

    /**
     * Ritorna la stampante associata a una categoria.
     */
    @JavascriptInterface
    public String getPrinterForCategory(String category) {
        try {
            PrinterConfig printer = printerManager.getPrinterForCategory(category);
            if (printer != null) {
                return printer.id;
            }
            return "";
        } catch (Exception e) {
            logger.e("AndroidPrinter", "getPrinterForCategory error", e);
            return "";
        }
    }

    /**
     * Imposta il numero di copie per una categoria.
     */
    @JavascriptInterface
    public void setCopiesForCategory(String category, int copies) {
        try {
            printerManager.setCopiesForCategory(category, copies);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "setCopiesForCategory error", e);
        }
    }

    /**
     * Ritorna il numero di copie per una categoria.
     */
    @JavascriptInterface
    public int getCopiesForCategory(String category) {
        try {
            return printerManager.getCopiesForCategory(category);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "getCopiesForCategory error", e);
            return 1;
        }
    }

    /**
     * Abilita/disabilita la stampa per una categoria.
     */
    @JavascriptInterface
    public void setCategoryEnabled(String category, boolean enabled) {
        try {
            printerManager.setCategoryEnabled(category, enabled);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "setCategoryEnabled error", e);
        }
    }

    /**
     * Verifica se la stampa è abilitata per una categoria.
     */
    @JavascriptInterface
    public boolean isCategoryEnabled(String category) {
        try {
            return printerManager.isCategoryEnabled(category);
        } catch (Exception e) {
            logger.e("AndroidPrinter", "isCategoryEnabled error", e);
            return true;
        }
    }

    // Utility
    private String escapeJson(String s) {
        if (s == null) return "";
        return s.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }
}
