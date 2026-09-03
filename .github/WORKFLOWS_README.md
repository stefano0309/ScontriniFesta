# GitHub Actions - Workflow di Test e Build

Questo progetto include 4 workflow GitHub Actions automatizzati per il testing e il building continuo dell'app Android.

## 📋 Workflow Disponibili

### 1. **main.yml** - Build APK (Principale)
**Trigger:** `push` su `main`/`master` + `workflow_dispatch` manuale

**Cosa fa:**
- ✅ Checkout codice
- ✅ Setup Java 17 + Android SDK
- ✅ Genera Gradle wrapper
- ✅ Compila APK debug
- ✅ Upload artefatto APK

**Quando usare:**
- Build automatica ad ogni push
- Generare APK per il deployment

**Output:**
- 📦 `app/build/outputs/apk/debug/app-debug.apk`

---

### 2. **test.yml** - Test Suite Completa
**Trigger:** `push`/`pull_request` su branch principali + `workflow_dispatch`

**Cosa fa:**

#### Fase 1: Verifica Struttura Progetto
- Verifica file build.gradle
- Verifica package di stampa
- Verifica asset webapp

#### Fase 2: Verifica AndroidManifest
- Permissions Bluetooth, USB
- Features USB OTG
- Configuration corretta

#### Fase 3: Verifica Bridge Android-JavaScript
- Import AndroidPrinterInterface
- Registrazione nel WebView
- Callback implementation

#### Fase 4: Verifica Webapp
- Tab "Stampanti" presente
- printers-ui.js incluso
- Inizializzazione PrintersModule

#### Fase 5: JavaScript Linting
- Sintassi JavaScript valida
- Funzioni principali presenti

#### Fase 6-8: Compilazione e Analisi
- Compilazione Java senza errori
- Static analysis
- Build APK completo

#### Fase 9-10: Verifica APK + Unit Tests
- Verifica APK generato
- Esegue unit tests (se presenti)

#### Fase 11 (Bonus): Test su Emulator
- Lancia emulator Android 35
- Installa APK
- Verifica che non crasha
- Verifica bridge caricato

**Quando usare:**
- Verificare che il build sia sano
- Garantire qualità codice
- Pre-deployment validation

**Status:** 
- ✅ Se tutti i test passano → OK per deployment
- ❌ Se fallisce → Fix required prima di merge

---

### 3. **printer-tests.yml** - Test Sistema di Stampa
**Trigger:** `push` modificando classi in `app/src/main/java/it/talloncinicassa/app/print/**`

**Cosa fa:**

| Test | Descrizione | Check |
|------|-------------|-------|
| TEST 1 | Struttura classi | Tutti i file .java presenti (11 classi) |
| TEST 2 | Implementazione interfacce | PrinterConnection implementato correttamente |
| TEST 3 | Metodi principali | connect(), disconnect(), write(), testConnection() |
| TEST 4 | Android imports | Bluetooth, USB, Network, SharedPreferences |
| TEST 5 | Costanti definite | Retry logic, queue parameters |
| TEST 6 | Sistema logging | PrintLogger con debug/info/warn/error |
| TEST 7 | Bridge JavaScript | Tutte le chiamate AndroidPrinter presenti |
| TEST 8 | Compilazione | compileDebugJava senza errori |
| TEST 9 | Configurazione USB | Parsing VID/PID esadecimale corretto |
| TEST 10 | Validazione | isValid() check prima di salvare |

**Quando usare:**
- Dopo modifiche al sistema di stampa
- Verificare integrità del package print
- Validation prima di test su device

**Status:**
- ✅ 10/10 tests = Printer system OK
- ❌ Fallisce = Bug nel package print

---

### 4. **webapp-tests.yml** - Test Webapp/JavaScript
**Trigger:** `push` modificando `app/src/main/assets/**`

**Cosa fa:**

| Test | Descrizione | Check |
|------|-------------|-------|
| TEST 1 | Struttura HTML | Tag html/head/body/script presenti |
| TEST 2 | Inclusione script | printers-ui.js incluso, PrintersModule init |
| TEST 3 | Sintassi JS | IIFE pattern, namespace definito |
| TEST 4 | Funzioni JS | Tutti i metodi esposti nel namespace |
| TEST 5 | Chiamate bridge | AndroidPrinter.* calls presenti |
| TEST 6 | Error handling | Try-catch, console logging, alerts |
| TEST 7 | Form validation | Validazione nome, IP, MAC, VID/PID |
| TEST 8 | Rendering dinamico | DOM manipulation, event listeners |
| TEST 9 | Modal dialogs | Show/close modals, field toggle |
| TEST 10 | State management | Variabili state presenti e reload logic |
| TEST 11 | Styling CSS | Classi CSS, responsive design |
| TEST 12 | ESLint (opzionale) | JavaScript linting |

**Quando usare:**
- Dopo modifiche a printers-ui.js
- Dopo modifiche a talloncini-cassa-5.html
- Verificare integrazione webapp

**Status:**
- ✅ 12/12 tests = Webapp OK
- ⚠️ ESLint fail = Avviso (non bloccante)

---

## 🚀 Come Usare i Workflow

### Trigger Automatico
I workflow si eseguono automaticamente quando:
- Fai `git push` su main/master
- Modifichi i file monitorati

### Trigger Manuale
1. Vai su **GitHub** → **Actions**
2. Seleziona il workflow desiderato
3. Clicca **"Run workflow"**
4. Seleziona il branch
5. Clicca **"Run workflow"**

### Visualizzare Risultati
1. Vai su **GitHub** → **Actions**
2. Vedi lista di workflow runs
3. Clicca su uno per vedere i dettagli
4. Scorri per vedere i log di ogni step

### Scaricare Artefatti
Se il workflow genera file (es: APK):
1. Vai su **Actions** → Seleziona run
2. Scorri fino a "Artifacts"
3. Clicca download

---

## 📊 Status Badge

Puoi aggiungere un badge nel README per mostrare lo status dei workflow:

```markdown
![Build APK](https://github.com/stefanodutto/ScontriniFesta/actions/workflows/main.yml/badge.svg)
![Tests](https://github.com/stefanodutto/ScontriniFesta/actions/workflows/test.yml/badge.svg)
![Printer Tests](https://github.com/stefanodutto/ScontriniFesta/actions/workflows/printer-tests.yml/badge.svg)
![Webapp Tests](https://github.com/stefanodutto/ScontriniFesta/actions/workflows/webapp-tests.yml/badge.svg)
```

---

## 🔧 Configurazione

### Requisiti di Sistema
- Java 17
- Android SDK 35
- Gradle 8.10.2
- Git

### File Necessari
```
.github/workflows/
├── main.yml              # Build APK
├── test.yml              # Test completo
├── printer-tests.yml     # Test stampa
└── webapp-tests.yml      # Test webapp
```

### Modifica dei Workflow
Per modificare un workflow:
1. Apri il file `.yml`
2. Modifica gli step
3. Commit e push
4. Il workflow aggiornato si eseguirà al prossimo trigger

---

## 📈 Metriche e Reporting

### Test Summary
Ogni workflow produce un summary alla fine che mostra:
- ✓ Test passati
- ✗ Test falliti
- ⏱️ Tempo esecuzione
- 📦 Artefatti generati

### Log Artifacts
Tutti i workflow caricano i log come artifacts:
- `test-results/` - Test run results
- `build/outputs/` - APK e compilazione
- `printer-test-logs/` - Print system test logs
- `webapp-test-report/` - Webapp test report

---

## ⚠️ Troubleshooting

### Workflow Fallisce su Compilazione
**Causa:** Errore di sintassi Java

**Soluzione:**
1. Vedi i log nel workflow
2. Leggi l'errore di compilazione
3. Correggi il file .java
4. Push di nuovo

### Test "AndroidPrinter non disponibile"
**Causa:** Bridge non registrato in MainActivity

**Soluzione:**
1. Verifica MainActivity.java riga ~95
2. Assicurati che `addJavascriptInterface()` sia presente
3. Ricompila

### Emulator test timeout
**Causa:** Emulator troppo lento

**Soluzione:**
1. È opzionale, fallimento non bloccante
2. Testa manualmente su device
3. Oppure disabilita e usa `continue-on-error: true`

### APK non generato
**Causa:** Errore durante build

**Soluzione:**
1. Vedi fase "Build APK (Full)" nei log
2. Leggi l'errore
3. Correggi il build.gradle se necessario
4. Riprova

---

## 📚 Risorse

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Android CI/CD Best Practices](https://developer.android.com/studio/build/ci-cd)
- [Gradle Documentation](https://gradle.org/docs/)

---

## 🎯 Best Practices

1. **Mantieni Workflow Aggiornati**
   - Aggiorna Android SDK regolarmente
   - Aggiorna Java version se necessario
   - Testa localmente prima di push

2. **Leggi i Log**
   - Non ignorare i warning
   - Verifica che tutti i test passino
   - Scarica gli artifacts per inspection

3. **Usa Branch Protections**
   - Richiedi che i workflow passino prima di merge
   - Impostazioni repo → Branches → Add rule

4. **Monitora i Costi**
   - GitHub Actions ha limiti gratuiti
   - Disabilita workflow se non necessari
   - Monitora l'utilizzo

---

## 📞 Supporto

Se un workflow fallisce:
1. Leggi il log completo
2. Identifica lo step che fallisce
3. Cerca la causa nel codice
4. Correggi e ripeti

---

**Ultimo aggiornamento:** 24 Agosto 2026  
**Version:** 1.0
