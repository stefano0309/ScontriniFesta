package it.talloncinicassa.app;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.DownloadListener;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.activity.ComponentActivity;
import androidx.activity.OnBackPressedCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;

import it.talloncinicassa.app.print.AndroidPrinterInterface;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/*
 * MODERNIZZAZIONE (compileSdk/targetSdk 35 - Android 15):
 * - Activity -> ComponentActivity, per usare la Activity Result API e
 *   OnBackPressedCallback al posto delle API deprecate.
 * - startActivityForResult/onActivityResult sostituiti da
 *   registerForActivityResult (deprecati dalla Activity 1.2).
 * - onBackPressed() sostituito da OnBackPressedCallback (deprecato dalla
 *   API 33).
 * - Le vecchie View.SYSTEM_UI_FLAG_* e setStatusBarColor/setNavigationBarColor
 *   sono deprecate e, a partire da targetSdk 35, l'edge-to-edge è forzato dal
 *   sistema: sostituite con WindowCompat/WindowInsetsControllerCompat.
 */
public class MainActivity extends ComponentActivity {

    private WebView webView;

    private ValueCallback<Uri[]> filePathCallback;

    private ActivityResultLauncher<Intent> fileChooserLauncher;
    private ActivityResultLauncher<Intent> createDocumentLauncher;

    // Dati del file che l'utente vuole esportare
    private byte[] pendingFileBytes;
    private String pendingFileName;
    private String pendingMimeType;

    // Timestamp dell'ultima pressione del tasto "indietro", usato per capire
    // se l'utente vuole davvero uscire dall'app (doppia pressione) invece di
    // uscire per sbaglio mentre lavora in cassa.
    private long lastBackPressTime = 0;
    private static final long BACK_PRESS_EXIT_WINDOW_MS = 2000;

    private static final String ASSET_URL =
            "file:///android_asset/talloncini-cassa-5.html";

    private AndroidPrinterInterface printerInterface;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        registerActivityResultLaunchers();
        registerBackPressedHandler();

        // DIAGNOSTICA: abilita l'ispezione remota via chrome://inspect solo
        // nelle build debuggabili (non in release), per poter vedere lo
        // stack trace completo degli errori JS dal telefono via USB.
        if ((getApplicationInfo().flags & android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // Sfondo scuro dietro le barre di sistema: con l'edge-to-edge forzato
        // da targetSdk 35, setStatusBarColor/setNavigationBarColor non hanno
        // più effetto affidabile, quindi coloriamo direttamente la decor view.
        getWindow().getDecorView().setBackgroundColor(0xFF1C1E22);

        webView = new WebView(this);
        setContentView(webView);

        setupWebView();

        hideSystemUi();

        webView.loadUrl(ASSET_URL);
    }

    /*
     * Registra i launcher della Activity Result API al posto di
     * startActivityForResult/onActivityResult (deprecati).
     * Va fatto prima che l'Activity raggiunga lo stato STARTED, quindi in
     * onCreate prima di ogni possibile launch().
     */
    private void registerActivityResultLaunchers() {

        fileChooserLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (filePathCallback == null) return;

                    Uri[] results = null;
                    Intent data = result.getData();

                    if (result.getResultCode() == RESULT_OK && data != null) {
                        Uri uri = data.getData();
                        if (uri != null) {
                            results = new Uri[]{uri};
                        }
                    }

                    filePathCallback.onReceiveValue(results);
                    filePathCallback = null;
                }
        );

        createDocumentLauncher = registerForActivityResult(
                new ActivityResultContracts.StartActivityForResult(),
                result -> {
                    if (result.getResultCode() == RESULT_OK && result.getData() != null) {
                        saveToUri(result.getData().getData());
                    } else {
                        pendingFileBytes = null;
                        pendingFileName = null;
                        pendingMimeType = null;

                        Toast.makeText(
                                this,
                                "Esportazione annullata.",
                                Toast.LENGTH_SHORT
                        ).show();
                    }
                }
        );
    }

    /*
     * Sostituisce onBackPressed() (deprecato dalla API 33) con
     * OnBackPressedCallback registrato sul dispatcher dell'Activity.
     */
    private void registerBackPressedHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {

                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                    return;
                }

                /*
                 * Evita di uscire per sbaglio dall'app durante il lavoro in
                 * cassa: la prima pressione avvisa, solo una seconda
                 * pressione entro pochi secondi chiude davvero l'app.
                 */
                long now = System.currentTimeMillis();

                if (now - lastBackPressTime < BACK_PRESS_EXIT_WINDOW_MS) {
                    setEnabled(false);
                    getOnBackPressedDispatcher().onBackPressed();
                } else {
                    lastBackPressTime = now;

                    Toast.makeText(
                            MainActivity.this,
                            "Premi di nuovo \"Indietro\" per uscire dall'app.",
                            Toast.LENGTH_SHORT
                    ).show();
                }
            }
        });
    }

    private void setupWebView() {

        WebSettings settings = webView.getSettings();

        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);

        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);

        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);

        settings.setMediaPlaybackRequiresUserGesture(false);

        /*
         * Bridge JS -> Android per il salvataggio dei file (blob/base64).
         * Registrato una sola volta qui invece che ad ogni download, per
         * evitare di ricrearlo inutilmente ogni volta che si esporta un file.
         */
        webView.addJavascriptInterface(
                new AndroidDownloadInterface(),
                "AndroidDownload"
        );

        /*
         * Bridge JS -> Android per il sistema di stampa nativo.
         * La webapp può controllare stampanti Bluetooth, LAN e USB direttamente.
         */
        printerInterface = new AndroidPrinterInterface(this, new AndroidPrinterInterface.Callback() {
            @Override
            public void onMessage(String message) {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, message, Toast.LENGTH_SHORT).show()
                );
            }

            @Override
            public void onError(String error) {
                runOnUiThread(() ->
                    Toast.makeText(MainActivity.this, "Errore stampa: " + error, Toast.LENGTH_LONG).show()
                );
            }
        });
        webView.addJavascriptInterface(printerInterface, "AndroidPrinter");

        /*
         * IMPORTAZIONE CSV / JSON
         */
        webView.setWebChromeClient(new WebChromeClient() {

            /*
             * DIAGNOSTICA: gli errori/console.error della pagina non erano
             * altrimenti visibili se non collegando un debugger. Loggandoli
             * su Logcat con tag dedicato si può recuperare lo stack reale
             * con "adb logcat -s CassaWebConsole" senza strumenti aggiuntivi.
             */
            @Override
            public boolean onConsoleMessage(android.webkit.ConsoleMessage cm) {
                android.util.Log.d(
                        "CassaWebConsole",
                        cm.message() + " -- " + cm.sourceId() + ":" + cm.lineNumber()
                );
                return true;
            }

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback =
                        filePathCallback;

                try {

                    Intent intent =
                            fileChooserParams.createIntent();

                    intent.addCategory(
                            Intent.CATEGORY_OPENABLE
                    );

                    fileChooserLauncher.launch(intent);

                } catch (ActivityNotFoundException e) {

                    MainActivity.this.filePathCallback = null;

                    Toast.makeText(
                            MainActivity.this,
                            "Nessun gestore file disponibile.",
                            Toast.LENGTH_LONG
                    ).show();

                    return false;
                }

                return true;
            }
        });

        /*
         * GESTIONE LINK E RAWBT
         */
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {

                return handleUrl(
                        request.getUrl().toString()
                );
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url) {

                return handleUrl(url);
            }

            /*
             * Se il processo di rendering del WebView va in crash (es. per
             * memoria insufficiente su tablet economici), di default Android
             * chiude l'intera app senza preavviso. Gestendo l'evento
             * possiamo invece ricreare la pagina e continuare a lavorare,
             * evitando la chiusura improvvisa richiesta di evitare.
             */
            @Override
            public boolean onRenderProcessGone(
                    WebView view,
                    RenderProcessGoneDetail detail) {

                Toast.makeText(
                        MainActivity.this,
                        "La pagina si è interrotta inaspettatamente, la sto ricaricando...",
                        Toast.LENGTH_LONG
                ).show();

                if (webView != null) {

                    if (webView.getParent()
                            instanceof android.view.ViewGroup) {

                        ((android.view.ViewGroup) webView.getParent())
                                .removeView(webView);
                    }

                    webView.destroy();
                }

                webView = new WebView(MainActivity.this);
                setContentView(webView);
                setupWebView();
                hideSystemUi();
                webView.loadUrl(ASSET_URL);

                /*
                 * Ritornando true diciamo al sistema che abbiamo gestito noi
                 * la situazione: l'app NON viene terminata.
                 */
                return true;
            }
        });

        /*
         * DOWNLOAD
         */
        webView.setDownloadListener(
                new DownloadListener() {

                    @Override
                    public void onDownloadStart(
                            String url,
                            String userAgent,
                            String contentDisposition,
                            String mimeType,
                            long contentLength) {

                        handleDownload(
                                url,
                                contentDisposition,
                                mimeType
                        );
                    }
                }
        );
    }

    /*
     * ---------------------------------------------------------
     * URL
     * ---------------------------------------------------------
     */

    private boolean handleUrl(String url) {

        if (url == null) {
            return false;
        }

        /*
         * RAWBT
         */
        if (url.startsWith("rawbt:")) {

            try {

                Intent intent =
                        new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(url)
                        );

                startActivity(intent);

                /*
                 * Avvisiamo la webapp che l'intent è partito correttamente,
                 * cosi' può considerare l'ordine come stampato e azzerarlo.
                 */
                notifyRawBtResult(true, null);

            } catch (ActivityNotFoundException e) {

                Toast.makeText(
                        this,
                        "RawBT non è installato.",
                        Toast.LENGTH_LONG
                ).show();

                /*
                 * Fondamentale per non perdere l'ordine: se RawBT non è
                 * disponibile la webapp NON deve azzerare l'ordine corrente
                 * né incrementare il contatore, altrimenti l'ordine
                 * scomparirebbe senza che nulla sia stato stampato.
                 */
                notifyRawBtResult(false, "RawBT non è installato.");
            }

            return true;
        }

        /*
         * Link esterni
         */
        if (url.startsWith("http://")
                || url.startsWith("https://")) {

            try {

                Intent intent =
                        new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(url)
                        );

                startActivity(intent);

            } catch (Exception ignored) {
            }

            return true;
        }

        return false;
    }

    /*
     * ---------------------------------------------------------
     * RAWBT CALLBACK VERSO LA WEBAPP
     * ---------------------------------------------------------
     */

    private void notifyRawBtResult(boolean ok, String message) {

        if (webView == null) {
            return;
        }

        String safeMessage =
                message != null
                        ? "'" + escapeJs(message) + "'"
                        : "null";

        String script =
                "window.__rawbtResult && window.__rawbtResult("
                        + (ok ? "true" : "false")
                        + ", "
                        + safeMessage
                        + ");";

        runOnUiThread(() ->
                webView.evaluateJavascript(script, null)
        );
    }

    /*
     * ---------------------------------------------------------
     * DOWNLOAD
     * ---------------------------------------------------------
     */

    private void handleDownload(
            String url,
            String contentDisposition,
            String mimeType) {

        try {

            String fileName =
                    extractFileName(
                            contentDisposition,
                            mimeType
                    );

            /*
             * Blob creato dalla web app.
             */
            if (url.startsWith("blob:")) {

                saveBlobFile(
                        url,
                        fileName,
                        mimeType
                );

                return;
            }

            /*
             * Data URL.
             */
            if (url.startsWith("data:")) {

                saveDataUrl(
                        url,
                        fileName,
                        mimeType
                );

                return;
            }

            /*
             * URL normale.
             */
            if (url.startsWith("http://")
                    || url.startsWith("https://")) {

                Intent intent =
                        new Intent(
                                Intent.ACTION_VIEW,
                                Uri.parse(url)
                        );

                startActivity(intent);

                return;
            }

            Toast.makeText(
                    this,
                    "Impossibile esportare il file.",
                    Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore durante l'esportazione.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /*
     * ---------------------------------------------------------
     * BLOB
     * ---------------------------------------------------------
     */

    private void saveBlobFile(
            String blobUrl,
            String fileName,
            String mimeType) {

        String safeUrl =
                blobUrl
                        .replace("\\", "\\\\")
                        .replace("'", "\\'");

        String script =
                "(async function() {" +

                "try {" +

                " const response = await fetch('" +
                safeUrl +
                "');" +

                " const blob = await response.blob();" +

                " const reader = new FileReader();" +

                " reader.onloadend = function() {" +

                "   AndroidDownload.save(" +
                "      reader.result," +
                "      '" +
                escapeJs(fileName) +
                "'," +
                "      '" +
                escapeJs(mimeType) +
                "'" +
                "   );" +

                " };" +

                " reader.readAsDataURL(blob);" +

                "} catch(e) {" +

                " AndroidDownload.error();" +

                "}" +

                "})()";

        webView.evaluateJavascript(
                script,
                null
        );
    }

    /*
     * ---------------------------------------------------------
     * DATA URL
     * ---------------------------------------------------------
     */

    private void saveDataUrl(
            String dataUrl,
            String fileName,
            String mimeType) {

        try {

            int commaIndex =
                    dataUrl.indexOf(',');

            if (commaIndex == -1) {
                throw new Exception(
                        "Data URL non valido"
                );
            }

            String header =
                    dataUrl.substring(
                            0,
                            commaIndex
                    );

            String data =
                    dataUrl.substring(
                            commaIndex + 1
                    );

            byte[] bytes;

            if (header.contains(";base64")) {

                bytes =
                        android.util.Base64.decode(
                                data,
                                android.util.Base64.DEFAULT
                        );

            } else {

                String decoded =
                        java.net.URLDecoder.decode(
                                data,
                                "UTF-8"
                        );

                bytes =
                        decoded.getBytes(
                                StandardCharsets.UTF_8
                        );
            }

            /*
             * NON salviamo direttamente nel filesystem.
             *
             * Apriamo il selettore Android:
             *
             * "Salva con nome"
             */
            openSaveDialog(
                    bytes,
                    fileName,
                    mimeType
            );

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore durante la preparazione del file.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /*
     * ---------------------------------------------------------
     * SALVA CON NOME ANDROID
     * ---------------------------------------------------------
     */

    private void openSaveDialog(
            byte[] bytes,
            String fileName,
            String mimeType) {

        pendingFileBytes = bytes;
        pendingFileName = fileName;
        pendingMimeType =
                mimeType != null
                        ? mimeType
                        : "application/octet-stream";

        Intent intent =
                new Intent(
                        Intent.ACTION_CREATE_DOCUMENT
                );

        intent.addCategory(
                Intent.CATEGORY_OPENABLE
        );

        intent.setType(
                pendingMimeType
        );

        intent.putExtra(
                Intent.EXTRA_TITLE,
                pendingFileName
        );

        try {

            createDocumentLauncher.launch(intent);

        } catch (ActivityNotFoundException e) {

            Toast.makeText(
                    this,
                    "Il dispositivo non supporta il salvataggio dei file.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /*
     * ---------------------------------------------------------
     * SALVATAGGIO NELLA POSIZIONE SCELTA
     * ---------------------------------------------------------
     */

    private void saveToUri(Uri uri) {

        if (uri == null || pendingFileBytes == null) {
            return;
        }

        try {

            OutputStream outputStream =
                    getContentResolver()
                            .openOutputStream(uri);

            if (outputStream == null) {
                throw new Exception(
                        "Impossibile aprire il file."
                );
            }

            outputStream.write(
                    pendingFileBytes
            );

            outputStream.flush();
            outputStream.close();

            Toast.makeText(
                    this,
                    "Impostazioni esportate correttamente.",
                    Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore nel salvataggio del file.",
                    Toast.LENGTH_LONG
            ).show();

        } finally {

            pendingFileBytes = null;
            pendingFileName = null;
            pendingMimeType = null;
        }
    }

    /*
     * ---------------------------------------------------------
     * FILE NAME
     * ---------------------------------------------------------
     */

    private String extractFileName(
            String contentDisposition,
            String mimeType) {

        if (contentDisposition != null) {

            String[] parts =
                    contentDisposition.split(";");

            for (String part : parts) {

                part = part.trim();

                if (part.startsWith("filename=")) {

                    String name =
                            part.substring(
                                    "filename=".length()
                            );

                    name =
                            name.replace(
                                    "\"",
                                    ""
                            );

                    if (!name.isEmpty()) {
                        return name;
                    }
                }
            }
        }

        if (mimeType != null
                && mimeType.contains("json")) {

            return "talloncini-cassa-impostazioni.json";
        }

        if (mimeType != null
                && mimeType.contains("csv")) {

            return "talloncini-cassa.csv";
        }

        return "talloncini-cassa-export";
    }

    /*
     * ---------------------------------------------------------
     * JAVASCRIPT BRIDGE
     * ---------------------------------------------------------
     */

    private class AndroidDownloadInterface {

        @android.webkit.JavascriptInterface
        public void save(
                String dataUrl,
                String fileName,
                String mimeType) {

            runOnUiThread(() -> {

                saveDataUrl(
                        dataUrl,
                        fileName,
                        mimeType
                );
            });
        }

        @android.webkit.JavascriptInterface
        public void error() {

            runOnUiThread(() ->

                    Toast.makeText(
                            MainActivity.this,
                            "Errore durante l'esportazione.",
                            Toast.LENGTH_LONG
                    ).show()
            );
        }
    }

    /*
     * ---------------------------------------------------------
     * JAVASCRIPT ESCAPE
     * ---------------------------------------------------------
     */

    private String escapeJs(String value) {

        if (value == null) {
            return "";
        }

        return value
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "\\r");
    }

    /*
     * ---------------------------------------------------------
     * FULLSCREEN
     * ---------------------------------------------------------
     */

    private void hideSystemUi() {

        // BUG FIX / MODERNIZZAZIONE: View.SYSTEM_UI_FLAG_* è deprecato dalla
        // API 30 e, con targetSdk 35, l'edge-to-edge forzato dal sistema rende
        // questo approccio inaffidabile. Si usa invece
        // WindowCompat/WindowInsetsControllerCompat per ottenere lo stesso
        // comportamento "kiosk" (barre di sistema nascoste, richiamabili con
        // uno swipe) in modo supportato su tutte le versioni da minSdk 23 in su.
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        WindowInsetsControllerCompat controller =
                WindowCompat.getInsetsController(getWindow(), webView);

        controller.setSystemBarsBehavior(
                WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        );
        controller.hide(WindowInsetsCompat.Type.systemBars());
    }

    @Override
    protected void onResume() {

        super.onResume();

        hideSystemUi();
    }

    /*
     * La modalità immersiva può essere annullata dal sistema (es. quando
     * appare un dialogo, il selettore file, o si cambia app e si torna
     * indietro). Riapplicandola quando la finestra riottiene il focus si
     * evita che la barra di sistema resti visibile e rovini l'esperienza
     * "da chiosco" della cassa.
     */
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {

        super.onWindowFocusChanged(hasFocus);

        if (hasFocus) {
            hideSystemUi();
        }
    }

    /*
     * La gestione del tasto "indietro" è ora registrata in
     * registerBackPressedHandler() (chiamato da onCreate) tramite
     * OnBackPressedCallback, che sostituisce onBackPressed() (deprecato
     * dalla API 33).
     */

    /*
     * ---------------------------------------------------------
     * CLEANUP
     * ---------------------------------------------------------
     */

    @Override
    protected void onDestroy() {

        if (webView != null) {

            webView.setWebViewClient(null);
            webView.setWebChromeClient(null);
            webView.destroy();
            webView = null;
        }

        super.onDestroy();
    }
}