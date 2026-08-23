package it.talloncinicassa.app.print;

import java.io.Closeable;
import java.io.IOException;

/**
 * Interfaccia base per tutte le connessioni stampanti.
 */
public interface PrinterConnection extends Closeable {

    /**
     * Apre la connessione alla stampante.
     * Bloccante; lanciare in background thread.
     */
    void connect() throws IOException;

    /**
     * Chiude la connessione.
     */
    void disconnect();

    /**
     * Verifica se la connessione è attiva.
     */
    boolean isConnected();

    /**
     * Invia dati ESC/POS alla stampante.
     * @param data byte array con comandi ESC/POS
     * @throws IOException se la connessione fallisce
     */
    void write(byte[] data) throws IOException;

    /**
     * Invia dati ESC/POS dalla stringa.
     */
    void write(String data) throws IOException;

    /**
     * Ritorna il tipo di connessione per debug/logging.
     */
    String getConnectionType();

    /**
     * Test di connessione (ping).
     */
    boolean testConnection() throws IOException;

    @Override
    void close() throws IOException;
}
