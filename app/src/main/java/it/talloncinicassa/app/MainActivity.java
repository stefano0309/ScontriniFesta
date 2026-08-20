package it.talloncinicassa.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.webkit.DownloadListener;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final int FILE_CHOOSER_REQUEST_CODE = 1001;
    private static final int CREATE_FILE_REQUEST_CODE = 1002;

    private WebView webView;

    private ValueCallback<Uri[]> filePathCallback;

    // Dati del file che l'utente vuole esportare
    private byte[] pendingFileBytes;
    private String pendingFileName;
    private String pendingMimeType;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(0xFF1C1E22);
        getWindow().setNavigationBarColor(0xFF1C1E22);

        webView = new WebView(this);
        setContentView(webView);

        setupWebView();

        hideSystemUi();

        webView.loadUrl(
                "file:///android_asset/talloncini-cassa-5.html"
        );
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
         * IMPORTAZIONE CSV / JSON
         */
        webView.setWebChromeClient(new WebChromeClient() {

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

                    startActivityForResult(
                            intent,
                            FILE_CHOOSER_REQUEST_CODE
                    );

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

            } catch (ActivityNotFoundException e) {

                Toast.makeText(
                        this,
                        "RawBT non è installato.",
                        Toast.LENGTH_LONG
                ).show();
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

        webView.addJavascriptInterface(
                new AndroidDownloadInterface(),
                "AndroidDownload"
        );

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

            startActivityForResult(
                    intent,
                    CREATE_FILE_REQUEST_CODE
            );

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
     * FILE PICKER RESULT
     * ---------------------------------------------------------
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

        /*
         * IMPORT CSV / JSON
         */
        if (requestCode ==
                FILE_CHOOSER_REQUEST_CODE) {

            if (filePathCallback == null) {
                return;
            }

            Uri[] results = null;

            if (resultCode == RESULT_OK
                    && data != null) {

                Uri uri =
                        data.getData();

                if (uri != null) {
                    results =
                            new Uri[]{uri};
                }
            }

            filePathCallback
                    .onReceiveValue(results);

            filePathCallback = null;

            return;
        }

        /*
         * EXPORT
         */
        if (requestCode ==
                CREATE_FILE_REQUEST_CODE) {

            if (resultCode == RESULT_OK
                    && data != null) {

                Uri uri =
                        data.getData();

                saveToUri(uri);

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

    /*
     * ---------------------------------------------------------
     * BACK
     * ---------------------------------------------------------
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