package it.talloncinicassa.app.print;

import android.content.Context;
import android.os.Handler;
import android.os.HandlerThread;

import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedList;
import java.util.List;
import java.util.Queue;

/**
 * Gestore della coda di stampa.
 * Elabora job sequenziali per stampante con retry automatici e backoff progressivo.
 * NON blocca il thread principale.
 */
public class PrintQueue {
    private static final int MAX_RETRY_COUNT = 3;
    private static final int INITIAL_RETRY_DELAY_MS = 1000;
    private static final int MAX_RETRY_DELAY_MS = 30000;

    private final Context context;
    private final PrintLogger logger = PrintLogger.getInstance();

    private final Queue<PrintJob> jobQueue = new LinkedList<>();
    private final List<PrintJobListener> listeners = new ArrayList<>();

    private HandlerThread workerThread;
    private Handler workerHandler;

    private PrintJob currentJob;
    private PrinterManager printerManager;

    public interface PrintJobListener {
        void onJobStateChanged(PrintJob job);
        void onJobCompleted(PrintJob job);
        void onJobFailed(PrintJob job, String error);
    }

    public PrintQueue(Context context, PrinterManager printerManager) {
        this.context = context;
        this.printerManager = printerManager;
        startWorker();
    }

    private void startWorker() {
        workerThread = new HandlerThread("PrintQueueWorker");
        workerThread.start();
        workerHandler = new Handler(workerThread.getLooper());
    }

    /**
     * Aggiunge un job alla coda.
     */
    public void enqueue(PrintJob job) {
        synchronized (jobQueue) {
            jobQueue.offer(job);
            logger.i("Queue", "Job aggiunto: " + job);
            notifyListeners(job);
        }
        processNext();
    }

    /**
     * Elabora il prossimo job nella coda.
     */
    private void processNext() {
        workerHandler.post(this::_processNextJob);
    }

    private void _processNextJob() {
        synchronized (jobQueue) {
            if (currentJob != null && currentJob.state == PrintJob.State.PRINTING) {
                return;  // Aspetta che il job attuale finisca
            }

            if (jobQueue.isEmpty()) {
                return;
            }

            currentJob = jobQueue.poll();
            if (currentJob == null) return;
        }

        if (currentJob == null) return;

        currentJob.state = PrintJob.State.PRINTING;
        currentJob.lastAttemptAt = System.currentTimeMillis();
        notifyListeners(currentJob);

        logger.i("Queue", "Inizio stampa: " + currentJob);

        try {
            printJob(currentJob);
            currentJob.state = PrintJob.State.COMPLETED;
            currentJob.lastError = null;
            logger.i("Queue", "Job completato: " + currentJob.jobId);
            notifyJobCompleted(currentJob);
            processNext();
        } catch (IOException e) {
            handleJobError(currentJob, e);
        }
    }

    private void handleJobError(PrintJob job, IOException error) {
        job.retryCount++;
        job.lastError = error.getMessage();

        if (job.retryCount > MAX_RETRY_COUNT) {
            job.state = PrintJob.State.FAILED;
            logger.e("Queue", "Job fallito dopo " + job.retryCount + " tentativi: " + job, error);
            notifyJobFailed(job, job.lastError);
            processNext();
            return;
        }

        job.state = PrintJob.State.RETRYING;
        long delayMs = (long) Math.min(
                MAX_RETRY_DELAY_MS,
                INITIAL_RETRY_DELAY_MS * Math.pow(2, job.retryCount - 1)
        );

        logger.w("Queue", "Retry " + job.retryCount + "/" + MAX_RETRY_COUNT +
                " tra " + (delayMs / 1000) + "s per " + job);
        notifyListeners(job);

        workerHandler.postDelayed(this::_processNextJob, delayMs);
    }

    private void printJob(PrintJob job) throws IOException {
        if (job.content == null || job.content.isEmpty()) {
            throw new IOException("Contenuto job vuoto");
        }

        PrinterConfig config = printerManager.getPrinter(job.printerId);
        if (config == null) {
            throw new IOException("Stampante non trovata: " + job.printerId);
        }

        if (!config.isValid()) {
            throw new IOException("Configurazione stampante non valida: " + config.name);
        }

        PrinterConnection connection = printerManager.createConnection(config);
        if (connection == null) {
            throw new IOException("Impossibile creare connessione per tipo: " + config.type);
        }

        try {
            connection.connect();
            
            // Stampa tutte le copie
            for (int i = 0; i < job.copies; i++) {
                connection.write(job.content);
            }

            connection.disconnect();
        } catch (IOException e) {
            try { connection.close(); } catch (IOException ignored) {}
            throw new IOException("Errore durante stampa: " + e.getMessage(), e);
        }
    }

    /**
     * Riprova a stampare un job.
     */
    public void retry(PrintJob job) {
        if (job == null) return;

        synchronized (jobQueue) {
            job.state = PrintJob.State.QUEUED;
            job.retryCount = 0;
            job.lastError = null;
            jobQueue.offer(job);
            logger.i("Queue", "Retry manuale richiesto: " + job);
            notifyListeners(job);
        }
        processNext();
    }

    /**
     * Annulla un job.
     */
    public void cancel(PrintJob job) {
        if (job == null) return;

        synchronized (jobQueue) {
            job.state = PrintJob.State.CANCELLED;
            logger.i("Queue", "Job annullato: " + job);
            notifyListeners(job);
            jobQueue.remove(job);
        }
        if (currentJob == job) {
            currentJob = null;
            processNext();
        }
    }

    /**
     * Registra un listener per gli eventi della coda.
     */
    public void addListener(PrintJobListener listener) {
        if (!listeners.contains(listener)) {
            listeners.add(listener);
        }
    }

    public void removeListener(PrintJobListener listener) {
        listeners.remove(listener);
    }

    private void notifyListeners(PrintJob job) {
        for (PrintJobListener listener : listeners) {
            listener.onJobStateChanged(job);
        }
    }

    private void notifyJobCompleted(PrintJob job) {
        for (PrintJobListener listener : listeners) {
            listener.onJobCompleted(job);
        }
    }

    private void notifyJobFailed(PrintJob job, String error) {
        for (PrintJobListener listener : listeners) {
            listener.onJobFailed(job, error);
        }
    }

    /**
     * Arresta il worker thread.
     */
    public void stop() {
        if (workerThread != null) {
            workerThread.quit();
            try {
                workerThread.join(5000);
            } catch (InterruptedException ignored) {}
        }
    }
}