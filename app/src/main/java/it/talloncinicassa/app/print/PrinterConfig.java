package it.talloncinicassa.app.print;

import android.content.Context;

/**
 * Configurazione base per una stampante.
 * Salvata in SharedPreferences.
 */
public class PrinterConfig {
    public String id;                    // UUID univoco
    public String name;                  // Nome visualizzato (es. "Stampante Bar")
    public String type;                  // "bluetooth", "network", "usb"
    public boolean enabled;              // Stampante attiva o disattivata

    // Bluetooth
    public String bluetoothAddress;      // MAC address (es. "AA:BB:CC:DD:EE:FF")
    public String bluetoothName;         // Nome dispositivo (es. "CSN-58II")

    // Network (LAN)
    public String networkAddress;        // IP (es. "192.168.1.50")
    public int networkPort;              // TCP port (default 9100)
    public int networkTimeoutMs;         // Timeout connessione (default 5000)

    // USB
    public int usbVendorId;
    public int usbProductId;
    public int usbInterfaceIndex;

    // ESC/POS
    public int paperWidth;               // 58 o 80 mm
    public boolean autoCut;              // Taglio automatico
    public boolean drawerOpen;           // Apertura cassetto
    public int spacer3cmLines;           // Righe per 3 cm di spazio bianco

    // Ristampa
    public long lastPrintedAt;
    public int defaultCopies;

    public PrinterConfig(String id, String name, String type) {
        this.id = id;
        this.name = name;
        this.type = type;
        this.enabled = true;
        this.networkPort = 9100;
        this.networkTimeoutMs = 5000;
        this.paperWidth = 80;
        this.autoCut = true;
        this.drawerOpen = false;
        this.spacer3cmLines = 8;  // circa 3 cm su termica standard
        this.defaultCopies = 1;
    }

    public boolean isValid() {
        if (!enabled) return false;
        if ("bluetooth".equals(type)) {
            return bluetoothAddress != null && !bluetoothAddress.isEmpty();
        } else if ("network".equals(type)) {
            return networkAddress != null && !networkAddress.isEmpty() && networkPort > 0;
        } else if ("usb".equals(type)) {
            return usbVendorId > 0;
        }
        return false;
    }

    @Override
    public String toString() {
        return String.format("PrinterConfig{name=%s, type=%s, enabled=%b}", name, type, enabled);
    }
}
