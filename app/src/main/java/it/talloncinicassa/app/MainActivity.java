package it.talloncinicassa.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;

    private WebView webView;

    private ValueCallback<Uri[]> filePathCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(0xFF1C1E22);
        getWindow().setNavigationBarColor(0xFF1C1E22);

        webView = new WebView(this);
        setContentView(webView);

        setupWebView();

        hideSystemUi();

        webView.loadUrl("file:///android_asset/talloncini-cassa-5.html");
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
         * IMPORT FILE
         *
         * Permette alla web app di usare:
         *
         * <input type="file">
         *
         * per importare CSV e JSON.
         */
        webView.setWebChromeClient(new WebChromeClient() {

            @Override
            public boolean onShowFileChooser(
                    WebView webView,
                    ValueCallback<Uri[]> filePathCallback,
                    FileChooserParams fileChooserParams) {

                // Se esiste una richiesta precedente, la annulliamo.
                if (MainActivity.this.filePathCallback != null) {
                    MainActivity.this.filePathCallback.onReceiveValue(null);
                }

                MainActivity.this.filePathCallback = filePathCallback;

                try {
                    Intent intent = fileChooserParams.createIntent();

                    intent.addCategory(Intent.CATEGORY_OPENABLE);

                    startActivityForResult(
                            intent,
                            FILE_CHOOSER_REQUEST_CODE
                    );

                } catch (ActivityNotFoundException e) {

                    MainActivity.this.filePathCallback = null;

                    Toast.makeText(
                            MainActivity.this,
                            "Nessun gestore file disponibile sul dispositivo.",
                            Toast.LENGTH_LONG
                    ).show();

                    return false;
                }

                return true;
            }
        });

        /*
         * LINK E RAWBT
         */
        webView.setWebViewClient(new WebViewClient() {

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    WebResourceRequest request) {

                return handleUrl(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(
                    WebView view,
                    String url) {

                return handleUrl(url);
            }
        });

        /*
         * DOWNLOAD
         *
         * Gestisce i file creati dalla web app con:
         *
         * Blob
         * URL.createObjectURL()
         * <a download="...">
         *
         * In particolare l'export JSON delle impostazioni.
         */
        webView.setDownloadListener(new DownloadListener() {

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
        });
    }

    /**
     * Gestione dei collegamenti esterni.
     */
    private boolean handleUrl(String url) {

        if (url == null) {
            return false;
        }

        /*
         * RAWBT
         *
         * La web app genera URL del tipo:
         *
         * rawbt:base64,...
         *
         * che devono essere passati all'app RawBT.
         */
        if (url.startsWith("rawbt:")) {

            try {

                Intent intent = new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(url)
                );

                startActivity(intent);

            } catch (ActivityNotFoundException e) {

                Toast.makeText(
                        this,
                        "RawBT non è installato. Installa RawBT Print Service.",
                        Toast.LENGTH_LONG
                ).show();
            }

            return true;
        }

        /*
         * Link HTTP/HTTPS.
         *
         * Se la web app dovesse aprire un sito esterno,
         * lo apriamo nel browser Android.
         */
        if (url.startsWith("http://")
                || url.startsWith("https://")) {

            try {

                Intent intent = new Intent(
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

    /**
     * Gestisce i file scaricati dalla WebView.
     */
    private void handleDownload(
            String url,
            String contentDisposition,
            String mimeType) {

        try {

            String fileName = extractFileName(
                    contentDisposition,
                    mimeType
            );

            /*
             * Caso Blob:
             *
             * blob:https://...
             *
             * oppure blob:file://...
             *
             * La WebView può consegnarci direttamente il contenuto
             * tramite URL.createObjectURL().
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
             * Caso data URL.
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
             * Caso URL HTTP/HTTPS.
             */
            if (url.startsWith("http://")
                    || url.startsWith("https://")) {

                Intent intent = new Intent(
                        Intent.ACTION_VIEW,
                        Uri.parse(url)
                );

                startActivity(intent);

                return;
            }

            Toast.makeText(
                    this,
                    "Impossibile salvare il file.",
                    Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore durante l'esportazione del file.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /**
     * Estrae il nome del file.
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
                            part.substring("filename=".length());

                    name = name.replace("\"", "");

                    if (!name.isEmpty()) {
                        return name;
                    }
                }
            }
        }

        if (mimeType != null
                && mimeType.contains("json")) {

            return "talloncini-cassa-export.json";
        }

        if (mimeType != null
                && mimeType.contains("csv")) {

            return "talloncini-cassa-export.csv";
        }

        return "talloncini-cassa-export";
    }

    /**
     * Salva un Blob creato dalla pagina.
     *
     * La WebView non permette direttamente di leggere un blob:
     * per questo utilizziamo JavaScript per recuperare il contenuto
     * e lo passiamo all'app.
     */
    private void saveBlobFile(
            String blobUrl,
            String fileName,
            String mimeType) {

        String safeUrl = blobUrl
                .replace("\\", "\\\\")
                .replace("'", "\\'");

        String script =
                "(async function() {" +
                "try {" +
                " const response = await fetch('" + safeUrl + "');" +
                " const blob = await response.blob();" +
                " const reader = new FileReader();" +
                " reader.onloadend = function() {" +
                "   AndroidDownload.save(" +
                "      reader.result," +
                "      '" + escapeJs(fileName) + "'," +
                "      '" + escapeJs(mimeType) + "'" +
                "   );" +
                " };" +
                " reader.readAsDataURL(blob);" +
                "} catch(e) {" +
                " AndroidDownload.error();" +
                "}" +
                "})()";

        webView.addJavascriptInterface(
                new AndroidDownloadInterface(),
                "AndroidDownload"
        );

        webView.evaluateJavascript(
                script,
                null
        );
    }

    /**
     * Gestisce un data URL.
     */
    private void saveDataUrl(
            String dataUrl,
            String fileName,
            String mimeType) {

        try {

            int commaIndex = dataUrl.indexOf(',');

            if (commaIndex == -1) {
                throw new IOException("Data URL non valido");
            }

            String data =
                    dataUrl.substring(commaIndex + 1);

            boolean base64 =
                    dataUrl.substring(0, commaIndex)
                            .contains(";base64");

            byte[] bytes;

            if (base64) {

                bytes =
                        android.util.Base64.decode(
                                data,
                                android.util.Base64.DEFAULT
                        );

            } else {

                String decoded =
                        URLDecoder.decode(
                                data,
                                "UTF-8"
                        );

                bytes =
                        decoded.getBytes(
                                java.nio.charset.StandardCharsets.UTF_8
                        );
            }

            saveBytesToDownloads(
                    bytes,
                    fileName,
                    mimeType
            );

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore durante il salvataggio.",
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /**
     * Interfaccia JavaScript usata per trasferire il Blob
     * dalla WebView ad Android.
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

    /**
     * Salva i byte nella cartella Download.
     */
    private void saveBytesToDownloads(
            byte[] bytes,
            String fileName,
            String mimeType) {

        try {

            File downloads =
                    Environment.getExternalStoragePublicDirectory(
                            Environment.DIRECTORY_DOWNLOADS
                    );

            if (!downloads.exists()) {
                downloads.mkdirs();
            }

            File file =
                    new File(
                            downloads,
                            fileName
                    );

            FileOutputStream output =
                    new FileOutputStream(file);

            output.write(bytes);
            output.flush();
            output.close();

            Toast.makeText(
                    this,
                    "File salvato in Download:\n" + fileName,
                    Toast.LENGTH_LONG
            ).show();

        } catch (Exception e) {

            Toast.makeText(
                    this,
                    "Errore nel salvataggio: " + e.getMessage(),
                    Toast.LENGTH_LONG
            ).show();
        }
    }

    /**
     * Ricezione del risultato del selettore file Android.
     */
    @Override
    protected void onActivityResult(
            int requestCode,
            int resultCode,
            Intent data) {

        super.onActivityResult(
                requestCode,
                resultCode,
                data
        );

        if (requestCode != FILE_CHOOSER_REQUEST_CODE) {
            return;
        }

        if (filePathCallback == null) {
            return;
        }

        Uri[] results = null;

        if (resultCode == RESULT_OK) {

            if (data != null) {

                Uri uri = data.getData();

                if (uri != null) {
                    results = new Uri[]{uri};
                }
            }
        }

        filePathCallback.onReceiveValue(results);

        filePathCallback = null;
    }

    /**
     * Escape per stringhe JavaScript.
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

    /**
     * Modalità fullscreen.
     */
    private void hideSystemUi() {

        getWindow()
                .getDecorView()
                .setSystemUiVisibility(

                        View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                                | View.SYSTEM_UI_FLAG_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                );
    }

    @Override
    protected void onResume() {

        super.onResume();

        hideSystemUi();
    }

    /**
     * Tasto indietro:
     *
     * se la WebView ha una cronologia, torna indietro;
     * altrimenti chiude l'app.
     */
    @Override
    public void onBackPressed() {

        if (webView != null
                && webView.canGoBack()) {

            webView.goBack();

        } else {

            super.onBackPressed();
        }
    }
}