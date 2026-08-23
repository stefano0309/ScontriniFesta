package it.talloncinicassa.app.print;

import java.nio.charset.StandardCharsets;

/**
 * Centralizza i comandi ESC/POS.
 * Evita di sparpagliarli nel codice e rende facile aggiungere nuove funzionalità.
 */
public class EscPosPrinter {

    // Caratteri di controllo ESC/POS
    private static final byte ESC = 0x1B;
    private static final byte GS = 0x1D;
    private static final byte LF = 0x0A;

    private PrinterConfig printerConfig;

    public EscPosPrinter(PrinterConfig config) {
        this.printerConfig = config;
    }

    /**
     * Inizializzazione stampante.
     */
    public byte[] initialize() {
        return new byte[]{ESC, '@'};
    }

    /**
     * Reset della stampante.
     */
    public byte[] reset() {
        return new byte[]{ESC, '@'};
    }

    /**
     * Allineamento: 0 = sinistra, 1 = centro, 2 = destra
     */
    public byte[] align(int alignment) {
        return new byte[]{ESC, 'a', (byte) Math.min(2, Math.max(0, alignment))};
    }

    /**
     * Testo normale.
     */
    public byte[] alignLeft() {
        return align(0);
    }

    public byte[] alignCenter() {
        return align(1);
    }

    public byte[] alignRight() {
        return align(2);
    }

    /**
     * Grassetto on/off.
     */
    public byte[] bold(boolean enable) {
        return new byte[]{ESC, 'E', (byte) (enable ? 1 : 0)};
    }

    /**
     * Dimensione testo: width e height sono 0-7 (0=1x, 1=2x, etc).
     */
    public byte[] setTextSize(int width, int height) {
        int w = Math.min(7, Math.max(0, width));
        int h = Math.min(7, Math.max(0, height));
        return new byte[]{GS, '!', (byte) ((h << 4) | w)};
    }

    /**
     * Dimensione normale 1x1.
     */
    public byte[] normalSize() {
        return setTextSize(0, 0);
    }

    /**
     * Testo grande 2x2.
     */
    public byte[] largeSize() {
        return setTextSize(1, 1);
    }

    /**
     * Testo molto grande 4x4.
     */
    public byte[] veryLargeSize() {
        return setTextSize(3, 3);
    }

    /**
     * Avanzamento carta (feed).
     * @param lines numero di righe da far avanzare
     */
    public byte[] feed(int lines) {
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.max(1, lines); i++) {
            sb.append((char) LF);
        }
        return sb.toString().getBytes(StandardCharsets.ISO_8859_1);
    }

    /**
     * Linea di trattini (circa 32 caratteri per stampante 58mm).
     */
    public byte[] line() {
        String dashes = "-".repeat(32);
        return (dashes + "\n").getBytes(StandardCharsets.ISO_8859_1);
    }

    /**
     * Taglio della carta (taglierino automatico).
     */
    public byte[] cut() {
        return new byte[]{GS, 'V', 0x01};  // Partial cut
    }

    /**
     * Taglio completo.
     */
    public byte[] fullCut() {
        return new byte[]{GS, 'V', 0x00};  // Full cut
    }

    /**
     * Apertura cassetto (comando cash drawer).
     */
    public byte[] openDrawer() {
        // Pin 2 e 5 (rispetto alle stampanti più comuni)
        return new byte[]{ESC, 'p', 0x00, 0x32, (byte) 0xFF};
    }

    /**
     * Testo con encoding ISO-8859-1.
     * Converte accenti non supportati per garantire compatibilità.
     */
    public byte[] text(String content) {
        String converted = removeUnsupportedChars(content);
        return converted.getBytes(StandardCharsets.ISO_8859_1);
    }

    /**
     * Newline.
     */
    public byte[] newline() {
        return new byte[]{LF};
    }

    /**
     * Spazio bianco: circa 3 cm su stampante standard da 80mm.
     * Il numero di righe può essere configurato in PrinterConfig.
     */
    public byte[] spacer3cm() {
        return feed(printerConfig.spacer3cmLines);
    }

    /**
     * Costruisce un ticket completo con tutti gli elementi.
     */
    public byte[] buildFullTicket(String bizName, int ticketNumber, String category,
                                  String[] items, String footer) {
        StringBuilder sb = new StringBuilder();

        // Inizializzazione
        sb.append(new String(initialize(), StandardCharsets.ISO_8859_1));

        // Spazio bianco iniziale se necessario
        // (configurabile per categoria nella logica superiore)

        // Intestazione
        sb.append(new String(alignCenter(), StandardCharsets.ISO_8859_1));
        sb.append(new String(bold(true), StandardCharsets.ISO_8859_1));
        sb.append(new String(text(bizName), StandardCharsets.ISO_8859_1));
        sb.append(new String(bold(false), StandardCharsets.ISO_8859_1));
        sb.append(new String(newline(), StandardCharsets.ISO_8859_1));
        sb.append(new String(setTextSize(1, 1), StandardCharsets.ISO_8859_1));  // Numero grande
        sb.append(new String(text("#" + String.format("%04d", ticketNumber)), StandardCharsets.ISO_8859_1));
        sb.append(new String(normalSize(), StandardCharsets.ISO_8859_1));
        sb.append(new String(newline(), StandardCharsets.ISO_8859_1));

        // Categoria
        if (category != null && !category.isEmpty()) {
            sb.append(new String(text(category), StandardCharsets.ISO_8859_1));
            sb.append(new String(newline(), StandardCharsets.ISO_8859_1));
        }

        sb.append(new String(line(), StandardCharsets.ISO_8859_1));

        // Items
        sb.append(new String(alignLeft(), StandardCharsets.ISO_8859_1));
        for (String item : items) {
            sb.append(new String(text(item), StandardCharsets.ISO_8859_1));
            sb.append(new String(newline(), StandardCharsets.ISO_8859_1));
        }

        sb.append(new String(line(), StandardCharsets.ISO_8859_1));

        // Footer
        sb.append(new String(alignCenter(), StandardCharsets.ISO_8859_1));
        if (footer != null && !footer.isEmpty()) {
            sb.append(new String(text(footer), StandardCharsets.ISO_8859_1));
            sb.append(new String(newline(), StandardCharsets.ISO_8859_1));
        }

        // Taglio automatico se abilitato
        if (printerConfig.autoCut) {
            sb.append(new String(feed(5), StandardCharsets.ISO_8859_1));
            sb.append(new String(cut(), StandardCharsets.ISO_8859_1));
        } else {
            sb.append(new String(feed(3), StandardCharsets.ISO_8859_1));
        }

        return sb.toString().getBytes(StandardCharsets.ISO_8859_1);
    }

    /**
     * Rimuove caratteri non supportati dalle stampanti termiche.
     * Converte accenti in caratteri base.
     */
    private String removeUnsupportedChars(String input) {
        String result = input;
        // Mappa accenti -> senza accento
        result = result.replace("à", "a").replace("á", "a").replace("â", "a").replace("ä", "a");
        result = result.replace("è", "e").replace("é", "e").replace("ê", "e").replace("ë", "e");
        result = result.replace("ì", "i").replace("í", "i").replace("î", "i").replace("ï", "i");
        result = result.replace("ò", "o").replace("ó", "o").replace("ô", "o").replace("ö", "o");
        result = result.replace("ù", "u").replace("ú", "u").replace("û", "u").replace("ü", "u");
        result = result.replace("ç", "c").replace("ñ", "n");
        result = result.replace("À", "A").replace("Á", "A");
        result = result.replace("È", "E").replace("É", "E");
        result = result.replace("Ì", "I");
        result = result.replace("Ò", "O");
        result = result.replace("Ù", "U");
        result = result.replace("€", "EUR");
        // Rimuovi altri caratteri unicode
        result = result.replaceAll("[^\\x00-\\x7F]", "?");
        return result;
    }
}
