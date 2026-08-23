package it.talloncinicassa.app.print;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.nio.charset.StandardCharsets;

/**
 * Connessione LAN / TCP-IP a stampante ESC/POS.
 */
public class NetworkPrinterConnection implements PrinterConnection {

    private final PrinterConfig config;
    private final PrintLogger logger;

    private Socket socket;
    private OutputStream outputStream;

    public NetworkPrinterConnection(PrinterConfig config) {
        this.config = config;
        this.logger = PrintLogger.getInstance();
    }

    @Override
    public void connect() throws IOException {
        if (isConnected()) return;

        logger.d("Network", "Connessione a " + config.networkAddress + ":" + config.networkPort);

        try {
            socket = new Socket();
            InetSocketAddress address = new InetSocketAddress(config.networkAddress, config.networkPort);
            socket.connect(address, config.networkTimeoutMs);
            outputStream = socket.getOutputStream();
            logger.d("Network", "Connesso a " + config.networkAddress + ":" + config.networkPort);
        } catch (IOException e) {
            if (socket != null) {
                try { socket.close(); } catch (IOException ignored) {}
                socket = null;
            }
            outputStream = null;
            throw new IOException(
                "Impossibile connettersi a " + config.networkAddress + ":" + config.networkPort
                + " (" + e.getMessage() + ")",
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
        logger.d("Network", "Disconnesso da " + config.networkAddress);
    }

    @Override
    public boolean isConnected() {
        return socket != null && socket.isConnected() && outputStream != null;
    }

    @Override
    public void write(byte[] data) throws IOException {
        if (!isConnected()) {
            throw new IOException("Stampante rete non connessa");
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
        return "Rete LAN (TCP)";
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
