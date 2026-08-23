# Sistema di Stampa Android - Guida al Setup e Testing

## 🎯 Obiettivo

APK autonomo che stampa direttamente su stampanti ESC/POS via Bluetooth, LAN o USB **senza** dipendenza da RawBT o altre app esterne.

## ✅ Status Implementazione

**Completato:**
- ✅ 11 classi Java in package `it.talloncinicassa.app.print`
- ✅ Bridge JavaScript-Android registrato in MainActivity
- ✅ Permissions dichiarate (Bluetooth, USB)
- ✅ Modulo UI JavaScript (printers-ui.js)
- ✅ Tab Stampanti integrato nella webapp
- ✅ Persistenza SharedPreferences
- ✅ Retry automatici con backoff esponenziale
- ✅ Tre tipi di connessione: Bluetooth SPP, Network TCP, USB OTG

## 🛠️ Prerequisiti Compilazione

### Sistema
- macOS / Linux / Windows
- Android SDK versione 35 (targetSdk)
- JDK 11 o superiore
- Android Studio (opzionale, ma consigliato)

### Device di Test
- Android 6.0+ (minSdk 23, targetSdk 35)
- Bluetooth abilitato (per test Bluetooth)
- USB OTG supportato (per test USB)
- Accesso rete locale (per test LAN)

## 🚀 Compilazione

### Opzione 1: Android Studio

1. Aprire il progetto in Android Studio
2. Sync Gradle files
3. Build → Make Project
4. Verificare "Build" output panel per eventuali errori
5. Run → Run 'app' su device/emulator

### Opzione 2: Gradle CLI

```bash
cd /Users/stefanodutto/Desktop/Scontrini\ festa

# Build debug APK
./gradlew assembleDebug
# Output: app/build/outputs/apk/debug/app-debug.apk

# Build release APK (con firma di test)
./gradlew assembleRelease
# Output: app/build/outputs/apk/release/app-release.apk

# Build con verifica Java
./gradlew compileDebugJava
```

## 🔧 Configurazione Iniziale

### 1. Prepare Stampante Bluetooth

```
Android Device Settings → Bluetooth
  ↓
Enable Bluetooth
  ↓
Scan for devices
  ↓
Select printer (es: "CSN-58II" o "TM-20")
  ↓
Pair (inserire PIN se richiesto, solitamente 0000 o 1234)
  ↓
Connected
```

Annotare MAC address (formato AA:BB:CC:DD:EE:FF)

### 2. Prepare Stampante Network

```
Stampante → Menu di amministrazione
  ↓
Network Settings
  ↓
Leggi IP address (es: 192.168.1.100)
  ↓
Verifica porta ESC/POS: 9100 (default)
```

Test da computer:
```bash
telnet 192.168.1.100 9100
# Dovrebbe connettersi senza errore
```

### 3. Prepare Stampante USB OTG

1. Collegare stampante via adattatore USB-C/Micro-USB
2. Verificare che appaia in system:
   ```bash
   adb shell lsusb
   # Esempio output:
   # Bus 001 Device 003: ID 04b8:0202 Seiko Epson Corp. TM-20
   ```
3. Annotare VID e PID (04b8:0202 → VID=04b8, PID=0202)

## 📱 Testing nella Webapp

### 1. Apri Tab Stampanti

1. Avviare app Android
2. Navigare a sezione "⚙️ Impostazioni"
3. Tap "🖨️ Stampanti" (nuovo tab)

### 2. Aggiungi Stampante (Bluetooth)

```
Tap "+ Aggiungi stampante"
  ↓
Nome: "Cassa Principale" (es.)
Tipo: "Bluetooth"
MAC Address: AA:BB:CC:DD:EE:FF (copia da Android Bluetooth settings)
Nome Dispositivo: CSN-58II (opzionale)
  ↓
Tap "Aggiungi"
```

### 3. Aggiungi Stampante (Network)

```
Tap "+ Aggiungi stampante"
  ↓
Nome: "Stampa Sala" (es.)
Tipo: "Network"
IP Address: 192.168.1.100
Porta: 9100
Timeout (ms): 5000
  ↓
Tap "Aggiungi"
```

### 4. Aggiungi Stampante (USB)

```
Tap "+ Aggiungi stampante"
  ↓
Nome: "Stampa USB" (es.)
Tipo: "USB"
Vendor ID: 04b8 (hex, senza 0x)
Product ID: 0202 (hex, senza 0x)
  ↓
Tap "Aggiungi"
```

### 5. Test Connessione

Per ogni stampante aggiunta:
```
Tap "Test"
  ↓
(Piccolo ritardo per connessione)
  ↓
Se OK: toast verde "Stampante OK"
Se errore: toast rosso "Errore: [dettagli]"
```

### 6. Associa a Categorie

Secondo pannello "Associa stampanti alle categorie":
```
Per ogni categoria menu (es: "Bevande", "Cibi", ecc.):
  - Dropdown: Seleziona stampante
  - Campo copie: 1, 2, 3...
  - Checkbox "Abilita": on/off
```

### 7. Stampa di Test

Da qualunque menu categoria configurato:
```
Aggiungi articolo al carrello
  ↓
Tap "Stampa" (o comando stampa categoria)
  ↓
(Stampante riceve dati)
  ↓
Scontrino stampa automaticamente
```

## 🐛 Troubleshooting

### Errore: "Bridge AndroidPrinter non trovato"

**Causa:** MainActivity non ha registrato il bridge

**Soluzione:**
1. Verificare MainActivity.java riga ~95:
   ```java
   webView.addJavascriptInterface(printerInterface, "AndroidPrinter");
   ```
2. Se mancante, aggiungere dopo AndroidDownloadInterface

### Errore: "Permesso Bluetooth negato"

**Causa:** Mancano runtime permissions su Android 6.0+

**Soluzione:**
1. Verificare AndroidManifest.xml ha permissions dichiarate
2. Implementare runtime permission request:
   ```java
   // In MainActivity.java onCreate():
   if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
       String[] perms = {
           Manifest.permission.BLUETOOTH_SCAN,
           Manifest.permission.BLUETOOTH_CONNECT
       };
       ActivityCompat.requestPermissions(this, perms, 100);
   }
   ```
3. Implementare callback onRequestPermissionsResult()

### Errore: "Stampante non trovata (Bluetooth)"

**Cause possibili:**
1. MAC address errato
   - Soluzione: Copiare esattamente da Android Bluetooth settings
2. Stampante non accoppiata
   - Soluzione: Accoppiare manualmente in Bluetooth Android
3. Stampante spenta o fuori portata
   - Soluzione: Accendere stampante, verificare Bluetooth range

### Errore: "Connessione rifiutata (Network)"

**Cause possibili:**
1. IP errato
   - Soluzione: Verificare con `ping 192.168.1.100` da PC
2. Porta 9100 non aperta
   - Soluzione: Verificare impostazioni stampante, accesso admin panel
3. Firewall locale blocca
   - Soluzione: Verificare regole firewall rete, aggiungere IP device

### Errore: "USB device not found"

**Cause possibili:**
1. VID/PID errati
   - Soluzione: Usare `adb shell lsusb` per verificare
2. Device non connesso
   - Soluzione: Ricollegate USB OTG e stampante
3. OTG non supportato
   - Soluzione: Verificare specifiche dispositivo Android

## 📊 Verificare Logging

### Android Studio

```
Logcat Filter:
"CassaStampa"

Cerca messaggi tipo:
[CassaStampa-BluetoothPrinterConnection] Connecting to AA:BB:CC:DD:EE:FF
[CassaStampa-PrintQueue] Job 123 started printing
[CassaStampa-EscPosPrinter] Sent 245 bytes to printer
```

### Linea Comando

```bash
adb logcat | grep "CassaStampa"

# Esempio output:
# I CassaStampa-PrinterManager: Loading printers from SharedPreferences
# D CassaStampa-BluetoothPrinterConnection: Socket connected
# I CassaStampa-PrintQueue: Job COMPLETED
```

## 📈 Performance e Limiti

| Aspetto | Valore | Note |
|---------|--------|------|
| Max job queue | Illimitato | Dipende RAM disponibile |
| Retry max | 3 | Configurabile in PrintQueue.java |
| Initial retry delay | 1 secondo | Configurabile |
| Max retry delay | 30 secondi | Configurabile |
| Socket timeout | 5 secondi | Per Network e USB |
| Thread workers | 1 | HandlerThread per coda sequenziale |
| Concurrent prints | 1 | Stampe sequenziali, non parallele |

## 🔐 Sicurezza

- **Permissions:** Dichiarate e controllate a runtime
- **SharedPreferences:** Nessuna encryption di base (aggiungere se richiesto)
- **Bridge JavaScript:** Accessibile solo da webapp locale (hardcoded in WebView)
- **Retry logic:** Implementato per evitare overload stampante

## 🎓 Architettura Finale

```
MainActivity (Activity)
    ↓
WebView (carica talloncini-cassa-5.html)
    ↓
JavaScript Bridge: window.AndroidPrinter
    ↓
AndroidPrinterInterface (Callback con onMessage/onError)
    ↓
PrinterManager (Registry + Factory)
    ↓
PrintQueue (HandlerThread processor)
    ↓
PrintJob → PrinterConnection (Interface)
    ├─ BluetoothPrinterConnection (RfcommSocket)
    ├─ NetworkPrinterConnection (Socket TCP)
    └─ UsbPrinterConnection (USB Host API)
    ↓
EscPosPrinter (Generatore comandi)
    ↓
Stampante Termica (riceve bytes ESC/POS)
```

## 📚 Risorse

- **Android ESC/POS Standard:** https://www.escpos.net/
- **Android Bluetooth API:** https://developer.android.com/guide/topics/connectivity/bluetooth
- **Android USB Host API:** https://developer.android.com/guide/topics/connectivity/usb/host
- **Android Runtime Permissions:** https://developer.android.com/guide/topics/permissions/overview

## ✅ Checklist Pre-Release

- [ ] Compilazione Java senza errori (`./gradlew compileDebugJava`)
- [ ] Compilazione APK senza errori (`./gradlew assembleDebug`)
- [ ] Tab "Stampanti" visualizzato in webapp
- [ ] Stampante Bluetooth aggiunta con successo
- [ ] Stampante Network aggiunta con successo
- [ ] Test connessione Bluetooth OK
- [ ] Test connessione Network OK
- [ ] Stampa da categoria con Bluetooth OK
- [ ] Stampa da categoria con Network OK
- [ ] Retry automatico funziona (spegnere stampante mid-print)
- [ ] Formato ESC/POS corretto (test alignment, bold, sizing)
- [ ] 3cm spacer funziona (configurabile da PrinterConfig)
- [ ] Taglio automatico funziona (se abilitato)
- [ ] Apertura cassetto funziona (se abilitato)
- [ ] Accenti convertiti correttamente (à→a, è→e)
- [ ] Permissions runtime richieste (Android 6.0+)
- [ ] Log CassaStampa visibile in logcat
- [ ] APK release firmato
- [ ] Nessuna dipendenza da RawBT
- [ ] Webapp original funcionality intact (menu, categorie, localStorage, etc)

## 🎉 Deployment

1. Generare APK release firmato:
   ```bash
   ./gradlew assembleRelease
   # Output: app/build/outputs/apk/release/app-release.apk
   ```

2. Testare su dispositivo real (non emulator)

3. Verificare tutti i test case nella checklist

4. Deploy agli utenti

5. Monitorare logcat per eventuali errori in production

---

**Status:** Pronto per build e testing  
**Ultima modifica:** 2024
