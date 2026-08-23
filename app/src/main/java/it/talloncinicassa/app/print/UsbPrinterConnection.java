package it.talloncinicassa.app.print;

import android.content.Context;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;

/**
 * Connessione USB OTG per stampanti ESC/POS.
 */
public class UsbPrinterConnection implements PrinterConnection {

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
