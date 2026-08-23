package it.talloncinicassa.app.print;

import android.util.Log;

/**
 * Logger centralizzato per il sistema di stampa.
 * Singleton per uniformare il debug.
 */
public class PrintLogger {
    private static final PrintLogger instance = new PrintLogger();
    private static final String TAG = "Cassa-Print";

    private PrintLogger() {}

    public static PrintLogger getInstance() {
        return instance;
    }

    public void d(String module, String message) {
        Log.d(TAG, "[" + module + "] " + message);
    }

    public void i(String module, String message) {
        Log.i(TAG, "[" + module + "] " + message);
    }

    public void w(String module, String message) {
        Log.w(TAG, "[" + module + "] " + message);
    }

    public void e(String module, String message) {
        Log.e(TAG, "[" + module + "] " + message);
    }

    public void e(String module, String message, Throwable e) {
        Log.e(TAG, "[" + module + "] " + message, e);
    }
}
