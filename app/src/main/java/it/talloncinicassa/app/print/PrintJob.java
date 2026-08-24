package it.talloncinicassa.app.print;

import java.util.Date;
import java.util.UUID;

/**
 * Rappresenta un singolo lavoro di stampa in coda.
 * Immutabile: lo stato viene gestito da PrintQueue tramite transazioni.
 */
public class PrintJob {
    public enum State {
        QUEUED,
        PRINTING,
        COMPLETED,
        FAILED,
        RETRYING,
        CANCELLED
    }

    public final String jobId;
    public final long createdAt;
    public final int ticketNumber;
    public final String category;
    // NOTA: deve contenere l'ID univoco della stampante (PrinterConfig.id),
    // non il nome visualizzato. PrinterManager.getPrinter() cerca per ID:
    // passare il nome qui causava un mismatch che faceva fallire ogni job
    // con "Stampante non trovata".
    public final String printerId;
    public final String content;
    public final int copies;

    // Stato mutabile gestito da PrintQueue
    public State state;
    public int retryCount;
    public String lastError;
    public long lastAttemptAt;

    public PrintJob(
            int ticketNumber,
            String category,
            String printerId,
            String content,
            int copies
    ) {
        this.jobId = UUID.randomUUID().toString();
        this.createdAt = System.currentTimeMillis();
        this.ticketNumber = ticketNumber;
        this.category = category;
        this.printerId = printerId;
        this.content = content;
        this.copies = Math.max(1, copies);
        this.state = State.QUEUED;
        this.retryCount = 0;
        this.lastError = null;
        this.lastAttemptAt = 0;
    }

    @Override
    public String toString() {
        return String.format(
                "PrintJob{jobId=%s, ticket=%d, printerId=%s, state=%s}",
                jobId, ticketNumber, printerId, state
        );
    }
}