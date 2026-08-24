package it.talloncinicassa.app.print;

import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.content.Context;
import android.os.Build;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/**
 * Connessione Bluetooth ESC/POS.
 * Supporta stampanti termiche Bluetooth Classic (non BLE).
 */
public class BluetoothPrinterConnection implements PrinterConnection {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB");

    private final Context context;
    private final PrinterConfig config;
    private final PrintLogger logger;

    private BluetoothSocket socket;
    private OutputStream outputStream;
    private BluetoothAdapter bluetoothAdapter;

    public BluetoothPrinterConnection(Context context, PrinterConfig config) {
        this.context = context;
        this.config = config;
        this.logger = PrintLogger.getInstance();
        this.bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    public void connect() throws IOException {
        if (isConnected()) return;

        if (bluetoothAdapter == null) {
            throw new IOException("Bluetooth non disponibile sul dispositivo");
        }

        if (!bluetoothAdapter.isEnabled()) {
            throw new IOException("Bluetooth è spento");
        }

        BluetoothDevice device;
        try {
            device = bluetoothAdapter.getRemoteDevice(config.bluetoothAddress);
        } catch (IllegalArgumentException e) {
            throw new IOException("Indirizzo Bluetooth non valido: " + config.bluetoothAddress, e);
        }
        if (device == null) {
            throw new IOException("Dispositivo Bluetooth non trovato: " + config.bluetoothAddress);
        }

        logger.d("Bluetooth", "Connessione a " + config.bluetoothName + " (" + config.bluetoothAddress + ")");

        try {
            // Crea socket SPP per la connessione seriale
            socket = device.createRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
            outputStream = socket.getOutputStream();
            logger.d("Bluetooth", "Connesso a " + config.bluetoothName);
        } catch (IOException e) {
            if (socket != null) {
                try { socket.close(); } catch (IOException ignored) {}
                socket = null;
            }
            outputStream = null;
            throw new IOException("Impossibile connettersi a " + config.bluetoothName + ": " + e.getMessage(), e);
        } catch (SecurityException e) {
            // BUG FIX: su Android 12+ (API 31) createRfcommSocketToServiceRecord()
            // e socket.connect() lanciano SecurityException se il permesso
            // runtime BLUETOOTH_CONNECT non è stato concesso. Prima non veniva
            // catturata: l'eccezione risaliva non gestita e faceva crashare
            // l'app invece di segnalare un errore di stampa gestito.
            if (socket != null) {
                try { socket.close(); } catch (IOException ignored) {}
                socket = null;
            }
            outputStream = null;
            throw new IOException(
                "Permesso Bluetooth mancante (BLUETOOTH_CONNECT). Concedi il permesso Bluetooth all'app nelle impostazioni di sistema.",
                e
            );
        }
    }

    @Override
    public void disconnect() {
        if (outputStream != null) {
            try { outputStream.close(); } catch (IOException ignored) {}
            outputStream = null;
        }
        if (socket != null) {
            try { socket.close(); } catch (IOException ignored) {}
            socket = null;
        }
        logger.d("Bluetooth", "Disconnesso da " + config.bluetoothName);
    }

    @Override
    public boolean isConnected() {
        return socket != null && socket.isConnected() && outputStream != null;
    }

    @Override
    public void write(byte[] data) throws IOException {
        if (!isConnected()) {
            throw new IOException("Stampante Bluetooth non connessa");
        }
        try {
            outputStream.write(data);
            outputStream.flush();
        } catch (IOException e) {
            disconnect();
            throw new IOException("Errore di scrittura sulla stampante: " + e.getMessage(), e);
        }
    }

    @Override
    public void write(String data) throws IOException {
        write(data.getBytes(StandardCharsets.ISO_8859_1));
    }

    @Override
    public String getConnectionType() {
        return "Bluetooth";
    }

    @Override
    public boolean testConnection() throws IOException {
        if (isConnected()) return true;
        
        try {
            connect();
            boolean connected = isConnected();
            disconnect();
            return connected;
        } catch (IOException e) {
            return false;
        }
    }

    @Override
    public void close() throws IOException {
        disconnect();
    }
}