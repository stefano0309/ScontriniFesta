package it.talloncinicassa.app.print;

import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Connessione USB OTG per stampanti ESC/POS.
 */
public class UsbPrinterConnection implements PrinterConnection {

    // BUG FIX: prima non esisteva alcun meccanismo di richiesta permesso USB.
    // openDevice() falliva silenziosamente (ritornava null) se l'utente non
    // aveva già concesso il permesso in precedenza, e non veniva mai chiesto.
    private static final String ACTION_USB_PERMISSION =
            "it.talloncinicassa.app.print.USB_PERMISSION";
    private static final long PERMISSION_TIMEOUT_SECONDS = 15;

    private final Context context;
    private final PrinterConfig config;
    private final PrintLogger logger;
    private final UsbManager usbManager;

    private UsbDeviceConnection deviceConnection;
    private UsbDevice usbDevice;
    private UsbEndpoint endpointOut;

    public UsbPrinterConnection(Context context, PrinterConfig config) {
        this.context = context;
        this.config = config;
        this.logger = PrintLogger.getInstance();
        this.usbManager = (UsbManager) context.getSystemService(Context.USB_SERVICE);
    }

    @Override
    public void connect() throws IOException {
        if (isConnected()) return;

        if (usbManager == null) {
            throw new IOException("USB Manager non disponibile");
        }

        // Cerca il dispositivo USB per vendor/product ID
        UsbDevice device = null;
        for (UsbDevice d : usbManager.getDeviceList().values()) {
            if (d.getVendorId() == config.usbVendorId &&
                d.getProductId() == config.usbProductId) {
                device = d;
                break;
            }
        }

        if (device == null) {
            throw new IOException("Stampante USB non trovata (VID:PID " + 
                config.usbVendorId + ":" + config.usbProductId + ")");
        }

        // Se il permesso non è già stato concesso, lo richiediamo e attendiamo
        // la risposta dell'utente (connect() è documentato come bloccante e va
        // sempre invocato da un thread in background: qui lo sfruttiamo per
        // aspettare in modo sincrono l'esito del dialog di sistema).
        if (!usbManager.hasPermission(device)) {
            logger.d("USB", "Permesso non concesso, lo richiedo per " + device.getDeviceName());
            if (!requestPermissionAndWait(device)) {
                throw new IOException(
                    "Permesso USB non concesso per la stampante (VID:PID " +
                    config.usbVendorId + ":" + config.usbProductId + ")"
                );
            }
        }

        logger.d("USB", "Connessione a stampante USB " + device.getDeviceName());

        try {
            UsbDeviceConnection connection = usbManager.openDevice(device);
            if (connection == null) {
                throw new IOException("Impossibile aprire il dispositivo USB (permission denied?)");
            }

            UsbInterface iface = device.getInterface(config.usbInterfaceIndex);
            if (iface == null) {
                throw new IOException("Interfaccia USB non trovata");
            }

            if (!connection.claimInterface(iface, true)) {
                throw new IOException("Impossibile richiedere interfaccia USB");
            }

            // Trova endpoint OUT
            endpointOut = null;
            for (int i = 0; i < iface.getEndpointCount(); i++) {
                UsbEndpoint ep = iface.getEndpoint(i);
                if (ep.getDirection() == UsbConstants.USB_DIR_OUT) {
                    endpointOut = ep;
                    break;
                }
            }

            if (endpointOut == null) {
                throw new IOException("Endpoint OUT non trovato");
            }

            this.usbDevice = device;
            this.deviceConnection = connection;
            logger.d("USB", "Connesso a stampante USB");
        } catch (IOException e) {
            if (deviceConnection != null) {
                deviceConnection.close();
                deviceConnection = null;
            }
            throw e;
        }
    }

    /**
     * Richiede il permesso di accesso al dispositivo USB e attende (con
     * timeout) l'esito scelto dall'utente nel dialog di sistema.
     * @return true se il permesso è stato concesso
     */
    private boolean requestPermissionAndWait(UsbDevice device) {
        final CountDownLatch latch = new CountDownLatch(1);
        final AtomicBoolean granted = new AtomicBoolean(false);

        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context ctx, Intent intent) {
                if (ACTION_USB_PERMISSION.equals(intent.getAction())) {
                    synchronized (this) {
                        boolean permission = intent.getBooleanExtra(
                                UsbManager.EXTRA_PERMISSION_GRANTED, false);
                        granted.set(permission);
                        latch.countDown();
                    }
                }
            }
        };

        IntentFilter filter = new IntentFilter(ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }

        try {
            int pendingIntentFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                // Dall'API 31 i PendingIntent inviati a componenti di sistema
                // devono dichiarare esplicitamente FLAG_MUTABLE o FLAG_IMMUTABLE.
                // UsbManager.requestPermission scrive extra nell'intent, quindi
                // serve MUTABLE.
                pendingIntentFlags |= PendingIntent.FLAG_MUTABLE;
            }

            PendingIntent permissionIntent = PendingIntent.getBroadcast(
                    context, 0, new Intent(ACTION_USB_PERMISSION), pendingIntentFlags);

            usbManager.requestPermission(device, permissionIntent);

            boolean completed = latch.await(PERMISSION_TIMEOUT_SECONDS, TimeUnit.SECONDS);
            if (!completed) {
                logger.w("USB", "Timeout in attesa del permesso USB");
                return false;
            }
            return granted.get();
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return false;
        } finally {
            try {
                context.unregisterReceiver(receiver);
            } catch (IllegalArgumentException ignored) {
                // già derregistrato
            }
        }
    }

    @Override
    public void disconnect() {
        if (deviceConnection != null) {
            deviceConnection.releaseInterface(usbDevice.getInterface(config.usbInterfaceIndex));
            deviceConnection.close();
            deviceConnection = null;
        }
        usbDevice = null;
        endpointOut = null;
        logger.d("USB", "Disconnesso da stampante USB");
    }

    @Override
    public boolean isConnected() {
        return deviceConnection != null && usbDevice != null && endpointOut != null;
    }

    @Override
    public void write(byte[] data) throws IOException {
        if (!isConnected()) {
            throw new IOException("Stampante USB non connessa");
        }

        try {
            int written = deviceConnection.bulkTransfer(endpointOut, data, data.length, 5000);
            if (written < 0) {
                throw new IOException("Errore di scrittura USB (bulkTransfer returned " + written + ")");
            }
        } catch (Exception e) {
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
        return "USB OTG";
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