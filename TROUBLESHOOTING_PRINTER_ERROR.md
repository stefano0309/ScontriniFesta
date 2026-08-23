# Troubleshooting: "Si è verificato un errore imprevisto. I dati sono stati persi."

## 🔍 Analisi del Problema

Quando aggiungi una stampante nel tab "Stampanti", riceivi l'errore:
```
"Si è verificato un errore imprevisto. I dati sono stati persi."
```

Questo errore significa che il **bridge JavaScript-Android non riesce a comunicare**.

## 📋 Cause Comuni e Soluzioni

### 1. Bridge Android non registrato

**Sintomo:** L'errore appare immediatamente al tap "Aggiungi stampante"

**Causa:** Il metodo `addPrinter()` di `AndroidPrinter` non è disponibile

**Soluzione:**
1. Apri Android Studio → Logcat
2. Filtra per: `CassaStampa` o `AndroidPrinter`
3. Verifica che vedi messaggi come:
   ```
   I CassaStampa-AndroidPrinterInterface: Interfaccia inizializzata
   ```
4. Se non vedi nulla, il bridge non è stato registrato in MainActivity.java

**Fix:**
Apri `app/src/main/java/it/talloncinicassa/app/MainActivity.java` e verifica le righe 95-115:
```java
// Bridge JS -> Android per il sistema di stampa nativo
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
```

Se manca, aggiungilo **dopo** la registrazione di `AndroidDownloadInterface`.

### 2. SharedPreferences non salvate

**Sintomo:** La stampante viene aggiunta ma non appare nella lista, o riappare l'errore

**Causa:** Il salvataggio su SharedPreferences fallisce

**Soluzione - Debug:**
1. Apri Logcat e cerca:
   ```
   CassaStampa-PrinterMgr
   ```
2. Dovresti vedere:
   ```
   I CassaStampa-PrinterMgr: Printer saved to preferences
   I CassaStampa-PrinterMgr: Caricate 1 stampanti
   ```
3. Se non vedi questi messaggi, c'è un problema di persistenza

**Fix nel codice:**
Nel file `PrinterManager.java`, metodo `savePrinter()`, aggiungi logging:
```java
public void savePrinter(PrinterConfig config) {
    // ... build string ...
    prefs.edit().putString(prefKey, sb.toString()).apply();
    logger.i("PrinterMgr", "Printer saved to preferences: " + config.name);
}
```

### 3. Configurazione stampante invalida

**Sintomo:** Aggiungi una stampante ma viene rifiutata dal sistema

**Causa:** I campi obbligatori sono vuoti o malformati

**Soluzione - Verifica:**
- **Bluetooth:** MAC address formato `AA:BB:CC:DD:EE:FF` (6 coppie esadecimali)
- **Network:** IP `192.168.1.100`, Porta numero intero (es: 9100)
- **USB:** VID e PID in esadecimale senza `0x` (es: `04b8`, `0202`)

**Debug nel JavaScript:**
Apri la Console del browser (F12) quando aggiungi una stampante:
```
1. Tap "🖨️ Stampanti"
2. Premi F12 o apri Developer Tools
3. Tap "Aggiungi stampante"
4. Guarda la console per messaggi di errore
```

Dovresti vedere:
```
[OK]  Cariate 0 stampanti
[OK]  AndroidPrinter disponibile
[OK]  addPrinter('MioDevice', 'bluetooth', 'address=AA:BB:CC:DD:EE:FF,name=CSN-58II')
[OK]  ✓ Stampante aggiunta con successo
```

Se vedi un errore come:
```
[ERROR] Formato dei numeri non valido (VID/PID devono essere esadecimali)
```

Significa che i VID/PID per USB non sono nel formato corretto.

### 4. Webapp non caricata dal file corretto

**Sintomo:** Premi il tab Stampanti ma non appare nulla

**Causa:** Il file `printers-ui.js` non è stato incluso correttamente nel HTML

**Soluzione:**
1. Verifica che `printers-ui.js` esista:
   ```bash
   ls -la /Users/stefanodutto/Desktop/Scontrini\ festa/app/src/main/assets/
   ```
   Dovrebbe mostrare:
   ```
   printers-ui.js (16K)
   talloncini-cassa-5.html (148K)
   ```

2. Verifica che il file HTML includa lo script:
   ```bash
   grep "printers-ui.js" /Users/stefanodutto/Desktop/Scontrini\ festa/app/src/main/assets/talloncini-cassa-5.html
   ```
   Dovrebbe mostrare:
   ```html
   <script type="text/javascript" src="printers-ui.js"></script>
   ```

3. Se non è presente, aggiungilo prima del tag `</body>` finale

### 5. Errore Java non catturato

**Sintomo:** Toast mostra "Si è verificato un errore imprevisto. I dati sono stati persi."

**Causa:** Un'eccezione Java non gestita nel bridge

**Soluzione - Debug:**
1. Apri Logcat in Android Studio
2. Seleziona il tuo dispositivo nella dropdown
3. Filtra per `AndroidPrinter` o `CassaStampa`
4. Aggiungi di nuovo una stampante e guarda il log
5. Dovrebbe comparire:
   ```
   E CassaStampa-AndroidPrinter: addPrinter error
   E java.lang.IllegalArgumentException: ...
   ```

Il messaggio di errore ti dirà esattamente cosa è sbagliato.

## 🛠️ Procedura di Debug Completa

Segui questi step in ordine:

### Step 1: Verifica il Caricamento del JavaScript

Apri Chrome DevTools (F12) e nella console digita:
```javascript
typeof AndroidPrinter
// Dovrebbe mostrare: "object"

typeof PrintersModule
// Dovrebbe mostrare: "object"

AndroidPrinter.getPrinters()
// Dovrebbe mostrare: "[]" o un array di stampanti JSON
```

Se risultato è `"undefined"`:
- Il bridge non è registrato
- Vedi la sezione "Bridge Android non registrato"

### Step 2: Controlla gli Errori Java

Apri Android Studio → Logcat e filtra per `CassaStampa`:
```
adb logcat | grep "CassaStampa"
```

Dovresti vedere:
```
I CassaStampa-AndroidPrinterInterface: Interfaccia inizializzata
D CassaStampa-PrinterMgr: Loading printers from SharedPreferences
...
```

Se non vedi niente:
1. L'app potrebbe non stare in esecuzione
2. Il logging potrebbe essere disabilitato
3. Il package name potrebbe essere diverso

### Step 3: Test Manuale della Stampante

Una volta che la stampante è aggiunta:
1. Apri il tab "Stampanti"
2. Tap sul pulsante "Test" accanto alla stampante
3. Se la stampante è Bluetooth e accoppiata, dovrebbe stampare un test

Se ricevi un errore di connessione:
- Verifica che la stampante sia accesa
- Verifica che il MAC address sia corretto
- Prova a ricaricare l'app

## 🔧 Modifiche Recenti per Fix

Abbiamo aggiunto i seguenti miglioramenti:

### 1. AndroidPrinterInterface.java
- Aggiunto controllo `printer.isValid()` prima di salvare
- Aggiunto parsing esadecimale per VID/PID: `Integer.parseInt(value, 16)`
- Aggiunto callback `onMessage()` per successo
- Migliorati messaggi di errore

### 2. printers-ui.js
- Aggiunto controllo del valore di ritorno di `addPrinter()`
- Migliorato logging degli errori JavaScript
- Aggiunta gestione timeout con `setTimeout()`
- Console logging più dettagliato

### 3. talloncini-cassa-5.html
- Aggiunto debug logging nell'inizializzazione
- Migliorato controllo della disponibilità di `PrintersModule`
- Aggiunto controllo di `AndroidPrinter` al caricamento

## 📱 Test Finale

Dopo le correzioni, prova questo flow:

```
1. Apri app
2. Accedi a Impostazioni (⚙️)
3. Tap "🖨️ Stampanti"
4. Tap "+ Aggiungi stampante"
5. Inserisci:
   - Nome: "Test"
   - Tipo: "Network"
   - IP: "192.168.1.1" (qualunque IP)
   - Porta: "9100"
6. Tap "Aggiungi"
   → Dovrebbe vedere un toast verde "✓ Stampante aggiunta con successo"
7. Dovrebbe riapparire il form vuoto
8. Scrollando giù dovrebbe apparire la stampante nella lista "Stampanti disponibili"
```

Se arriva al punto 6 con successo, il bridge funziona!

## 📞 Contatti Debug

Se il problema persiste, fornisci:

1. **Logcat output:**
   ```bash
   adb logcat -s "CassaStampa" -d > log.txt
   # Inviami il contenuto di log.txt
   ```

2. **Browser Console output:**
   - F12 → Console
   - Copia tutti i messaggi e gli errori

3. **Versione app:**
   - Verifica `app/build.gradle`
   - Controlla `minSdk`, `targetSdk`, `compileSdk`

4. **Dispositivo:**
   - Marca e modello
   - Versione Android
   - Se è un emulator o device fisico

---

**Ultima modifica:** 24 Agosto 2026  
**Status:** Troubleshooting aggiornato
