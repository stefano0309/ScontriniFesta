# Audit di stabilizzazione — Tabby (cassa/talloncini) pre-refactor React

**Obiettivo del documento:** fornire la base di conoscenza condivisa per stabilizzare il monolite attuale (`www/index.html`) prima di avviare il refactor React, secondo la Definition of Done concordata.

**Perimetro auditato:** `index.html` (3.518 righe, HTML+CSS+JS in un unico file, "vanilla JS", nessun bundler/framework). L'app si chiama internamente **Tabby** (title `<title>Tabby</title>`), ma nel codice sorgente e nel `localStorage` la convenzione dei nomi è ancora `talloncini-cassa` (probabile nome storico/precedente del progetto — vedi §7, Rischi).

> ⚠️ **Limite dell'audit**: il file referenzia uno script esterno, `printers-ui.js` (righe 3484–3515), che **non è stato incluso** nell'upload e quindi **non è stato analizzato**. Espone un oggetto globale `PrintersModule` (con `.init()` e `.addPrinterModal()`) e viene testato con `typeof AndroidPrinter`, segno di un bridge nativo Android per stampanti ESC/POS via Bluetooth/LAN/USB. Va incluso nel prossimo giro di audit prima di considerare la mappatura completa (vedi §3.4 e §7.1).

---

## 1. Inventario funzionalità

L'app ha due "viste" principali commutate via `display:none`/`classList`, non da un router: **Vista Cassa** (`#cashierView`) e **Vista Amministrazione** (`#adminView`, dietro login). Non c'è alcun framework: lo stato vive in variabili globali (`let menu, order, salesLog, settings, ...`) e il DOM viene ridisegnato a colpi di `innerHTML` da funzioni `renderXxx()`.

### 1.1 Vista Cassa (`#cashierView`)
| Funzione | Descrizione | Punti d'ingresso nel codice |
|---|---|---|
| Griglia piatti | Elenco piatti/menu raggruppati per categoria, con prezzo, badge "venduti" e "countdown" (limite pezzi) | `renderDishGrid()`, `dishSoldQty()`, `dishRemainingQty()` |
| Composizione ordine | Tocco su un piatto → riga ordine con quantità incrementabile/decrementabile, note non editabili da UI cassa | `addToOrder()`, `changeQty()`, `removeOrderLine()`, `renderOrderCashier()` |
| Bozza ordine persistente | L'ordine in corso è salvato ad ogni modifica e ripristinato al riavvio (crash/uccisione processo Android) | `saveOrderDraft()`, `clearOrderDraft()`, listener `visibilitychange`/`pagehide` |
| Invio e stampa | Riserva un numero scontrino, genera N talloncini cucina + 1 scontrino riepilogativo (opzionale), stampa (dialogo di sistema o RawBT), registra la vendita | listener `#printOrderBtn`, `reserveTicketNumber()`, `getKitchenTicketsList()`, `recordSale()` |
| Svuota ordine | Reset dell'ordine corrente con conferma | listener `#clearOrderCashierBtn` |
| Modifica ultimo ordine | Riapre l'ultimo scontrino non annullato per aggiungere/rimuovere righe *dopo* la stampa, ristampando solo le righe aggiunte | `renderLastOrderShortcut()`, `openSaleEditor()`, `saveEditedSale()`, `printAddedSaleLines()` |
| Esaurito / countdown piatto | Blocco automatico dell'aggiunta al superamento di `maxQty` | `dishRemainingQty()`, disabilitazione bottone in `renderDishGrid()` |
| Banner errori dati | Avviso persistente (non auto-nascosto) per problemi di salvataggio/sync | `showDataWarning()` |
| Accesso Admin | Ingranaggio in alto a destra → modale login | `#openAdminBtn`, `doLogin()` |

### 1.2 Vista Amministrazione (`#adminView`, tab-based via `data-tab`)
| Tab | Funzione | Note |
|---|---|---|
| **Menu** | Aggiunta/modifica/eliminazione piatti; piatti "singoli" o "menu" (combo di più talloncini); toggle per-piatto (visibile in cassa, contatore vendite, countdown, limite max) | `addDishBtn`, `window.editDish`, `window.deleteDish`; l'editing usa `prompt()` nativi del browser, non un form dedicato |
| **Importa CSV** | Import massivo piatti da CSV (`nome,prezzo,categoria`), con o senza intestazione, delimitatore auto-rilevato (`,`/`;`), modalità aggiungi o sostituisci | `parseCsvMenu()`, `detectDelimiter()`, `parseCsvLine()` (parser CSV custom, non libreria) |
| **💰 Fondo Cassa** | Impostazione fondo cassa iniziale serata + registrazione di contante aggiunto durante il servizio (multi-dispositivo, ognuno con `push()` Firebase) | `saveCashFloat()`, `addCashAdditionEntry()`, `removeCashAdditionEntry()` |
| **Chiusura Cassa** | Riepilogo vendite dall'ultima chiusura (per piatto), stampa riepilogo, "Chiudi cassa e azzera" (svuota `salesLog`, `cashFloat`, `cashAdditions` — irreversibile) | `renderChiusuraCassa()`, `aggregateSalesLog()`, listener `#resetCloseBtn` |
| **🧾 Storico** | Elenco scontrini con ricerca/filtro data, dettaglio riga per riga, annulla/ripristina scontrino (void, non cancellazione), modifica scontrino, ristampa | `renderAdminHistory()`, `ahToggleVoid()`, `ahOpenDetail()`, `ahReprint()` (righe 3168–3481, modulo IIFE separato) |
| **🖨️ Stampanti** | Configurazione stampanti ESC/POS dirette (Bluetooth/LAN/USB) e associazione stampante↔categoria | Delegata **interamente** a `printers-ui.js` (non auditato — vedi limite sopra) |
| **Impostazioni** | Dati attività/scontrino, larghezza carta, metodo di stampa (dialogo di sistema vs RawBT), taglio automatico RawBT, tema, etichetta dispositivo, contatore ordini, credenziali admin, backup import/export | `fillSettingsForm()`, listener `#saveSettingsBtn`, `exportSettings()`, `importSettingsFromPayload()` |

### 1.3 Funzioni trasversali
- **Sincronizzazione Firebase Realtime Database**, con fallback locale offline-first e riconnessione automatica con backoff (§4).
- **Motore di stampa** con due modalità (dialogo di stampa di sistema via `window.print()` oppure RawBT via intent URL `rawbt:base64,...`) e generazione ESC/POS raw per RawBT (§3.3).
- **Persistenza locale** su `localStorage` con meccanismo di backup "a un tick di ritardo" per resistere a interruzioni (§3.2).
- **Gestione errori globali**: cattura `window.onerror` / `unhandledrejection` con messaggio non distruttivo per l'utente.

---

## 2. Mappatura funzionalità e dipendenze

### 2.1 Dipendenze esterne (runtime, da rete)
| Dipendenza | Uso | Rischio se offline/irraggiungibile |
|---|---|---|
| `fonts.googleapis.com` (Google Fonts: Oswald, Inter, JetBrains Mono) | Solo estetica | Fallback silenzioso al font di sistema, nessun impatto funzionale |
| Firebase JS SDK v12.18.0 via `gstatic.com` (app, database, auth) caricato come **modulo ES da CDN** (`<script type="module">`, righe 966–1012) | Autenticazione anonima + Realtime Database (sync multi-dispositivo) | Se il CDN non è raggiungibile al primo load, l'intera app JS "classica" successiva non si blocca (è in uno script separato), ma `window.FirebaseCassa`/`window.firebaseReady` restano `undefined`/`false` e la sync non parte mai finché la pagina non viene ricaricata con rete disponibile |
| `printers-ui.js` (locale, stesso host, non auditato) | Modulo stampanti ESC/POS dirette | Se il file manca/fallisce, il tab "Stampanti" resta vuoto/non inizializzato (gestito con `console.error`, non blocca il resto dell'app) |
| Bridge nativo Android `AndroidPrinter` (oggetto `window`, iniettato dal wrapper Android, non presente nel file) | Presumibilmente usato da `printers-ui.js` per comunicare via Bluetooth/USB/LAN | Fuori perimetro di questo file; da documentare nel prossimo audit |
| Intent `rawbt:` (app esterna RawBT Print Service) | Stampa diretta senza finestra di dialogo | Se RawBT non è installata, `sendViaRawBtAndWait()` riceve un fallimento tramite `window.__rawbtResult` (bridge Android→JS) ed evita di considerare l'ordine come stampato |
| `window.print()` (dialogo di stampa nativo del browser/WebView) | Modalità di stampa alternativa a RawBT | Richiede intervento manuale dell'operatore (conferma dialogo) |

### 2.2 Repository / build (da `main.yml`, `security.yml`)
- Il progetto è pacchettizzato come **APK Android** via GitHub Actions (`Build Android APK`: Gradle + Android SDK 35, `assembleDebug`), quindi `index.html` (+ `printers-ui.js`) risiede tipicamente in una cartella `app/src/.../assets/www/` di un progetto Android (WebView-based, non Cordova/Capacitor esplicito nei file visti — da confermare nel repo).
- Esiste una pipeline `Security & Quality Checks` schedulata settimanalmente: da includere nella checklist di regressione come controllo automatico continuo, indipendente da questo audit.
- **Non è stato fornito** il codice nativo Android (Java/Kotlin) che espone `AndroidPrinter`/`printers-ui.js`/l'intent `rawbt:`: è una dipendenza critica di questo file e va tracciata come repo/modulo separato nel modello di dipendenze.

### 2.3 Dipendenze interne (accoppiamento tra funzionalità)
- La **stampa** e la **registrazione vendita** sono accoppiate in un'unica transazione applicativa in due punti del codice (invio ordine `printOrderBtn`, e modifica scontrino `saveEditedSale`): se la stampa fallisce, la vendita **non** viene registrata e il contatore non avanza; se la stampa riesce ma il salvataggio (locale o Firebase) fallisce, viene mostrato un banner ma l'ordine risulta comunque stampato (vedi §5.1, flusso critico).
- Le **categorie** non sono un'entità a sé: sono stringhe derivate al volo dai piatti (`groupByCategory`) e le relative impostazioni (cumulativo/spacer/stampabile) sono mappe `{ categoria: bool }` in `settings`, quindi rinominare una categoria nel menu "orfana" le impostazioni associate alla vecchia stringa (nessuna migrazione automatica).
- Il tab **Stampanti** (per-categoria → per-stampante) e le impostazioni di stampa "classiche" (dialogo/RawBT in Impostazioni) sembrano essere **due sistemi di stampa paralleli non integrati** nel codice visto: il flusso reale di stampa ordine (`printOrderBtn`) usa solo `settings.printMethod` (dialog/rawbt), mai `PrintersModule`. Questo è un gap importante da chiarire con chi ha introdotto `printers-ui.js` prima del refactor (vedi §7.1).

---

## 3. Modello dati

Non esiste uno schema formale: tutto è JSON in memoria, specchiato su `localStorage` (prefisso `talloncini-cassa:`) e in parte su Firebase RTDB. Di seguito lo schema **ricostruito dal codice**.

### 3.1 Entità applicative

**MenuItem / Dish** (`menu: MenuItem[]`)
| Campo | Tipo | Obbligatorio | Note |
|---|---|---|---|
| `id` | string | sì | generato con `uid()` (random, non garantito univoco a livello crittografico ma sufficiente in pratica) |
| `name` | string | sì | |
| `price` | number | sì | in unità di valuta (non centesimi); i "menu/combo" non hanno prezzo proprio in stampa cucina (`noPrice:true` sui talloncini componenti) |
| `cat` | string | no (default "Senza categoria" a runtime) | |
| `type` | `'dish' \| 'combo'` | sì | `combo` = gruppo di piatti stampati come talloncini separati indipendenti |
| `items` | string[] | solo se `combo` | nomi liberi (non riferimenti ad altri `MenuItem.id`) — un combo **non** decrementa i contatori/limiti dei piatti che lo compongono, perché `items` sono stringhe libere |
| `showInCashier` | boolean | no (default `true`) | |
| `showSalesCounter` | boolean | no (default `false`) | mostra badge "Venduti N" in cassa |
| `showCountdown` | boolean | no (default `false`, forzato `true` se `maxQty>0`) | mostra badge "Rimasti N"/"ESAURITO" |
| `maxQty` | number | no (default `0` = nessun limite) | limite pezzi vendibili nella serata |

**OrderLine** (bozza ordine corrente, `order: OrderLine[]`)
| Campo | Tipo | Note |
|---|---|---|
| `dishId` | string | riferimento a `MenuItem.id` |
| `name`, `price` | string/number | **copiati** da `MenuItem` al momento dell'aggiunta (snapshot, non riferimento live: un cambio prezzo a menu non altera un ordine già in corso) |
| `qty` | number | |
| `note` | string | presente nel modello ma **non editabile da UI cassa standard** (nessun input note visibile nel flusso normale; usato però da `saleEditorDraft`/vendite storiche) |

**Sale** (scontrino registrato, `salesLog: Sale[]`)
| Campo | Tipo | Note |
|---|---|---|
| `orderNum` | number | contatore locale al dispositivo (non globale) |
| `ts` | ISO string | timestamp emissione |
| `lines` | `{dishId, name, qty, price, note}[]` | snapshot righe |
| `total` | number | somma `price*qty` |
| `deviceId` | string | id dispositivo che ha emesso lo scontrino |
| `deviceTag` | string | etichetta dispositivo al momento dell'emissione (es. "A") — **il numero visualizzato/stampato è sempre `deviceTag-orderNum`**, mai il solo `orderNum` |
| `voided` | boolean | annullato = escluso dai totali ma resta visibile |
| `voidedAt`, `voidedReason` | ISO string / string | presenti solo se `voided` |
| `modifiedAt`, `lastEdit` | ISO string / oggetto | presenti solo se lo scontrino è stato modificato dopo l'emissione (`{added, beforeTotal, afterTotal, modifiedAt}`) |
| `_fbKey` | string (runtime only) | chiave del nodo Firebase; **rimossa esplicitamente prima di ogni scrittura** (`saleForStorage`) — è uno scarto locale, non va persa di vista nel refactor |

**Settings** (oggetto singolo condiviso)
| Campo | Tipo | Default | Note |
|---|---|---|---|
| `bizName` | string | `'La Mia Attività'` | |
| `footer` | string | `'Grazie e arrivederci'` | |
| `vat` | string | `''` | testo libero, non validato come P.IVA |
| `currency` | string | `'€'` | testo libero, non un vero codice valuta |
| `paperWidth` | number | `58` | 58 o 80 (mm) |
| `showPricesKitchen` | boolean | `false` | |
| `autoSummary` | boolean | `true` | include scontrino riepilogativo cliente |
| `printMethod` | `'dialog' \| 'rawbt'` | `'rawbt'` nel default in-memory, ma il placeholder HTML mostra "dialogo" come opzione predefinita — **incoerenza da verificare** (vedi §7.2) |
| `rawbtCut` | boolean | `false` | |
| `rawbtCutFeedLines` | number | `5` | clampato 3–20 al salvataggio |
| `theme` | `'dark' \| 'light'` | `'dark'` | |
| `categoryCumulative` | `{[categoria]: boolean}` | `{}` (default per-categoria = `true`/cumulativo se assente) | |
| `categorySpacer3cm` | `{[categoria]: boolean}` | `{}` (default `false`) | |
| `categoryPrintTicket` | `{[categoria]: boolean}` | `{}` (default `true`) | |

**CashFloat** (fondo cassa, oggetto singolo condiviso)
`{ amount: number, note: string, setAt: ISOstring|null }`

**CashAddition** (`cashAdditions: CashAddition[]`)
`{ amount, note, ts, deviceId, deviceTag, _fbKey? }` — evento immutabile, mai aggiornato in place (solo aggiunto/rimosso)

**Creds** (credenziali admin — **solo locali, mai su Firebase**)
`{ username: string, password: string }` — **in chiaro**, confronto stringa diretta in `doLogin()` (vedi §7, rischi di sicurezza)

**Identità dispositivo** (persistita in `localStorage`, non in `settings`)
- `deviceId`: stringa random generata una tantum (`uid()+uid()`), stabile per dispositivo/installazione.
- `deviceTag`: etichetta breve (max 4 caratteri) scelta dall'admin, "prenotata" su Firebase con transazione atomica (`cassa/deviceTags/{tag}`) per garantire unicità tra dispositivi; se non impostata, derivata provvisoriamente da `deviceId`.

### 3.2 Persistenza locale — chiavi `localStorage` (prefisso `talloncini-cassa:`)
| Chiave | Contenuto | Note |
|---|---|---|
| `device-id` | `deviceId` | |
| `device-tag` | `deviceTag` | |
| `menu-items` | `menu` | |
| `ticket-counter` | `ticketCounter` (number) | **per dispositivo**, non condiviso |
| `app-settings` | `settings` | |
| `admin-creds` | `creds` | **mai sincronizzato su Firebase** |
| `sales-log` | `salesLog` | |
| `cash-float` | `cashFloat` | |
| `cash-additions` | `cashAdditions` | |
| `current-order-draft` | `order` (bozza ordine corrente) | |
| `{chiave}:backup` | copia della versione precedente di ognuna delle chiavi sopra | scritta *prima* di ogni nuova scrittura, letta solo come fallback se il valore principale risulta corrotto (JSON non parsabile) — **non è un vero backup incrementale**, è un solo livello di rollback |

### 3.3 Firebase Realtime Database — struttura (nodo radice `cassa/`)
| Percorso | Contenuto | Scrittura da | Note |
|---|---|---|---|
| `cassa/menu` | mappa `{id: MenuItem}` | `saveMenu()` (sovrascrittura totale) | |
| `cassa/settings` | `Settings` | `saveSettings()` (sovrascrittura totale) | |
| `cassa/counters/{deviceTag}` | number | `saveCounter()`, mirror "fire and forget" da `reserveTicketNumber()` | **non autorevole**: solo specchio informativo per il pannello admin; il contatore reale resta locale per dispositivo |
| `cassa/sales` | mappa `{chiave: Sale}` con chiave `order_XXXX__{deviceId}` oppure la `_fbKey` push già nota | `saveSalesLog()` (sovrascrittura totale, usata solo per reset chiusura), `saveSaleEntry()` (update mirato, uso normale) | il double-path (set totale vs update mirato) è una fonte di rischio di race condition da testare esplicitamente (§6) |
| `cassa/cashFloat` | `CashFloat` | `saveCashFloat()` | |
| `cassa/cashAdditions` | mappa `{pushKey: CashAddition}` | `addCashAdditionEntry()` (push), `removeCashAdditionEntry()` (remove), azzerato con `set(null)` alla chiusura cassa | |
| `cassa/deviceTags/{tag}` | `{deviceId, claimedAt}` | `setDeviceTag()`/`verifyDeviceTagClaim()` via `runTransaction` | garanzia di unicità etichetta dispositivo |

**Autenticazione:** `signInAnonymously()` (Firebase Auth) — nessuna distinzione di ruolo lato Firebase: ogni dispositivo autenticato anonimamente ha gli stessi diritti di lettura/scrittura sull'intero nodo `cassa/` (le regole di sicurezza effettive del database **non sono nel file** e andrebbero verificate separatamente nella console Firebase).

### 3.4 Contratti di stampa (payload verso l'esterno)
- **Modalità "dialog"**: HTML iniettato in `#printArea` (pagine `.print-page` con stile dinamico per larghezza carta) seguito da `window.print()`. Contratto = markup HTML generato da `renderKitchenPage()`/`renderSummaryPage()`/`buildCloseSummaryHtmlPage()`.
- **Modalità "rawbt"**: stringa di comandi **ESC/POS raw** (charset singolo, accenti traslitterati via `ACCENT_MAP`, caratteri >255 sostituiti con `?`) codificata Base64 e inviata come URL `rawbt:base64,{payload}` via `window.location.href`. Generata da `buildKitchenEscPos()`/`buildSummaryEscPos()`/`buildCloseSummaryEscPos()`. Esito comunicato in modo asincrono dal lato nativo tramite `window.__rawbtResult(ok, message)`.
- **Modulo Stampanti (`printers-ui.js`, non auditato)**: presumibilmente un terzo contratto di stampa (diretto ESC/POS su Bluetooth/LAN/USB), **non confermato collegato** al flusso reale di stampa ordine — da verificare con l'audit del file mancante.

---

## 4. Flussi critici identificati

### 4.1 Invio ordine → stampa → registrazione vendita (percorso principale, cassa)
1. Operatore compone l'ordine (`order[]`), persistito ad ogni tocco (`saveOrderDraft`).
2. Tocco "Invia e Stampa" → **doppio blocco anti-doppio-tocco** (`btn.disabled` + `dataset.printing`).
3. `reserveTicketNumber()`: incremento contatore **locale** (autorevole), mirror best-effort su Firebase.
4. Costruzione talloncini cucina (`getKitchenTicketsList`, dipende da categoria: cumulativo/non cumulativo/combo/spacer/stampabile).
5. Stampa (RawBT con attesa esito, o dialogo di sistema senza attesa esplicita di conferma utente).
6. **Solo se la stampa è considerata riuscita**, si registra la vendita (`recordSale`) e si svuota l'ordine.
7. Se il salvataggio (locale o Firebase) fallisce dopo una stampa riuscita, viene mostrato solo un banner non bloccante: **l'ordine risulta stampato ma potenzialmente non nello storico** finché non risincronizza.

**Punto critico per i test di regressione**: cosa succede se l'app/il processo viene ucciso *esattamente* tra step 5 (stampa avvenuta) e step 6 (registrazione vendita)? L'ordine risulta stampato ma non in `salesLog`, e alla riapertura l'ordine bozza persistente (`current-order-draft`) potrebbe risultare ancora pieno (dato che `clearOrderDraft()` avviene solo a fine funzione), rischiando una **doppia stampa** al reinvio.

### 4.2 Unicità del numero scontrino multi-dispositivo
Basata su etichetta dispositivo (`A-0007`) invece che su un contatore condiviso, per funzionare anche completamente offline. Punti critici:
- Due dispositivi con la **stessa etichetta** per errore → collisione silenziosa finché non arriva l'avviso di `verifyDeviceTagClaim()` (solo se e quando torna online).
- Cambio etichetta a metà serata su un dispositivo con scontrini già emessi → scontrini vecchi restano con l'etichetta precedente (corretto per storicità, ma da verificare che lo storico non si confonda nei filtri/ricerche).

### 4.3 Sincronizzazione offline→online (bootstrap Firebase)
`bootstrapFirebaseFromLocal()` viene eseguito ad ogni evento `firebase-ready` con `ready:true` (quindi anche a ogni riconnessione, non solo al primo avvio): invia al server menu/settings/contatore/cashFloat solo se assenti server-side, ma invia **sempre** le vendite locali non ancora presenti server-side e le aggiunte di cassa non ancora "pushate". Punto critico: comportamento in caso di **conflitto** (stesso ordine modificato offline su due dispositivi, o stesso `_fbKey` di cashAddition mai assegnato per doppio tentativo di push) non è testato nel codice: va verificato empiricamente.

### 4.4 Modifica scontrino dopo la stampa
`saveEditedSale()` calcola il **delta positivo** di quantità (`positiveLineDelta`) tra righe originali e nuova bozza, ristampa **solo** i talloncini aggiunti (non l'intero ordine), poi aggiorna `salesLog`. Punti critici:
- Se la ristampa del delta fallisce, la modifica **non viene salvata affatto** (blocco corretto, ma va confermato che l'utente capisca di dover riprovare).
- Le **diminuzioni** di quantità non stampano nulla (corretto logicamente) ma **non esiste un talloncino "storno"** per informare la cucina di una riduzione — rischio operativo reale da validare col cliente/utente finale, non solo tecnico.
- Il controllo limiti (`validateEditedSaleLimits`) somma le quantità vendute *escludendo* lo scontrino in modifica: va testato con più scontrini contemporaneamente in editing (scenario multi-dispositivo).

### 4.5 Chiusura cassa e azzeramento
Operazione distruttiva e irreversibile (`salesLog = []`, `cashFloat` azzerato, `cashAdditions = []`, incluso `set(null)` su Firebase) dietro un solo `confirm()` nativo. **Non c'è export/archiviazione automatica** prima dell'azzeramento: l'unico modo per conservare lo storico della serata è aver stampato il riepilogo cassa (`printCloseBtn`) *prima* di premere "Chiudi cassa e azzera" — nessun collegamento automatico tra i due bottoni.

### 4.6 Import/Export impostazioni (backup)
`exportSettings()` include **anche le credenziali admin in chiaro** nel JSON esportato (campo `creds`). `importSettingsFromPayload()` sovrascrive menu/impostazioni/credenziali senza merge selettivo (tranne un `Object.assign` parziale su `settings`). Da trattare come materiale sensibile nella checklist di sicurezza.

### 4.7 Import CSV menu
Parser CSV custom (gestisce virgolette e delimitatore auto-rilevato `,`/`;`), tollerante a errori riga per riga (righe scartate con log, mai bloccante sull'intero file). Punto critico: **non** deduplica per nome — importare due volte lo stesso CSV in modalità "aggiungi" crea piatti duplicati con `id` diversi.

---

## 5. Servizi e contratti — riepilogo per il refactor React

Questa sezione riassume i "confini di servizio" da preservare (o rifare 1:1 come API) nel nuovo frontend, indipendentemente dall'implementazione UI:

1. **Servizio Menu** — CRUD piatti/combo, import CSV, toggle per-piatto (visibilità cassa, contatori, limiti). Storage: `cassa/menu` + `menu-items`.
2. **Servizio Ordine/Vendite** — composizione ordine, riserva numero, stampa, registrazione vendita, modifica post-stampa, void/restore. Storage: `cassa/sales` + `sales-log`; dipende dal Servizio Identità Dispositivo per l'unicità del numero.
3. **Servizio Identità Dispositivo** — id dispositivo, etichetta con prenotazione atomica, contatore locale. Storage: `localStorage` + `cassa/deviceTags`, `cassa/counters`.
4. **Servizio Cassa/Fondo** — fondo cassa iniziale, aggiunte di contante, aggregazione e chiusura. Storage: `cassa/cashFloat`, `cassa/cashAdditions` + rispettive chiavi locali.
5. **Servizio Impostazioni** — configurazione attività/scontrino/stampa/tema/categorie, backup import/export. Storage: `cassa/settings` + `app-settings`. **Le credenziali admin restano fuori da questo servizio** (mai su Firebase).
6. **Servizio Stampa** — due (o tre, includendo `printers-ui.js`) implementazioni alternative dietro la stessa interfaccia logica ("stampa questi talloncini + questo riepilogo"): dialogo browser, RawBT ESC/POS via intent, e il modulo Stampanti non auditato. **Da unificare dietro un'unica interfaccia nel refactor**, con adapter per ciascun canale.
7. **Servizio Sync** — bridge Firebase (autenticazione anonima, listener realtime, bootstrap alla riconnessione). Da isolare come layer dati indipendente dalla UI (attualmente è fortemente intrecciato con le funzioni di rendering, es. i listener `onValue` chiamano direttamente `renderXxx()`).

---

## 6. Checklist di regressione (test manuali)

Da eseguire ad ogni modifica al monolite durante la fase di stabilizzazione, e come base per i test E2E del nuovo frontend React.

### 6.1 Cassa — flusso base
- [ ] Aggiungere piatti diversi all'ordine, verificare totale corretto.
- [ ] Incrementare/decrementare/azzerare quantità di una riga; verificare che a 0 la riga sparisca.
- [ ] Svuotare ordine con conferma; annullare la conferma non deve svuotare nulla.
- [ ] Inviare e stampare un ordine con piatti di categorie **cumulative** e **non cumulative** miste; verificare numero e contenuto dei talloncini.
- [ ] Inviare un ordine contenente un **combo/menu**; verificare che stampi un talloncino separato per ciascun componente, senza prezzo (se da impostazione) e senza toccare i limiti/contatori dei piatti "singoli" con lo stesso nome.
- [ ] Verificare badge "Venduti N" e "Rimasti N"/"ESAURITO" si aggiornino subito dopo aggiunta **e** dopo rimozione/riduzione riga (bug storico noto e corretto, da ri-testare ad ogni refactor).
- [ ] Raggiungere il `maxQty` di un piatto: verificare blocco aggiunta sia in griglia sia se già presente in bozza ordine.
- [ ] Uccidere/ricaricare l'app con un ordine in corso (non ancora stampato): verificare ripristino bozza e messaggio "Ordine in corso ripristinato".
- [ ] Testare entrambe le modalità di stampa (dialogo di sistema, RawBT) con RawBT **non installato** (deve fallire in modo pulito, ordine conservato, nessun avanzamento contatore/registrazione).

### 6.2 Modifica ultimo ordine
- [ ] Verificare che il pulsante "✎" sia disabilitato se non c'è alcuno scontrino modificabile (nessuno emesso, o l'ultimo è annullato).
- [ ] Aumentare la quantità di una riga esistente e aggiungere un piatto nuovo: verificare che si stampino **solo** i talloncini del delta positivo, e che il totale/registro si aggiornino.
- [ ] Diminuire una quantità: verificare che non stampi nulla e che il totale scenda correttamente.
- [ ] Salvare senza alcuna modifica reale: verificare che chiuda senza side-effect (nessuna nuova stampa, nessun `modifiedAt`).
- [ ] Tentare una modifica che supererebbe un `maxQty`: verificare blocco con messaggio corretto.
- [ ] Simulare fallimento di stampa del delta (es. RawBT assente): verificare che la modifica **non** venga salvata.

### 6.3 Multi-dispositivo / offline
- [ ] Due dispositivi con etichette diverse (es. A, B): emettere ordini in parallelo, verificare assenza di collisioni sui numeri scontrino.
- [ ] Impostare la stessa etichetta su due dispositivi (di proposito): verificare comparsa del banner di conflitto al riconnettersi.
- [ ] Portare un dispositivo offline (aereo), emettere ordini, poi riconnettere: verificare che le vendite locali arrivino su Firebase senza duplicati né sovrascritture di vendite dell'altro dispositivo.
- [ ] Verificare che il menu/impostazioni modificati su un dispositivo si propaghino in tempo reale sugli altri online.
- [ ] Verificare comportamento se Firebase è irraggiungibile all'avvio (nessun errore bloccante, banner informativo, riconnessione automatica col backoff).

### 6.4 Storico e annullamento
- [ ] Filtrare storico per numero scontrino e per intervallo date.
- [ ] Annullare uno scontrino (void) con motivo: verificare che esca dai totali chiusura/media ma resti visibile nello storico con etichetta "ANNULLATO".
- [ ] Ripristinare uno scontrino annullato: verificare rientri nei totali.
- [ ] Ristampare uno scontrino (anche annullato, con conferma extra): verificare uso della stessa pipeline di stampa configurata (dialogo/RawBT).
- [ ] Verificare che "Modifica" sia disabilitata su scontrini annullati.

### 6.5 Fondo cassa e chiusura
- [ ] Impostare fondo cassa iniziale con nota; verificare comparsa nel riepilogo chiusura.
- [ ] Aggiungere più "contanti aggiunti" da dispositivi diversi; verificare somma corretta e assenza di sovrascritture (uso di `push`).
- [ ] Eliminare una singola aggiunta: verificare rimozione locale e su Firebase.
- [ ] Stampare il riepilogo chiusura **prima** di "Chiudi cassa e azzera" (workflow consigliato): verificare dati coerenti tra i due.
- [ ] Eseguire "Chiudi cassa e azzera": verificare azzeramento completo (vendite, fondo, aggiunte) su **tutti** i dispositivi collegati, e che sia effettivamente irreversibile.

### 6.6 Menu, CSV, impostazioni
- [ ] Aggiungere/modificare/eliminare un piatto singolo e un combo (min. 2 componenti obbligatori).
- [ ] Importare CSV con intestazione e senza, con delimitatore `,` e `;`, con righe malformate (verificare skip riga-per-riga senza bloccare l'intero import).
- [ ] Importare CSV in modalità "sostituisci" con conferma; annullare la conferma non deve modificare il menu.
- [ ] Cambiare tema chiaro/scuro; verificare persistenza dopo reload.
- [ ] Cambiare metodo di stampa e opzioni RawBT (taglio automatico, righe di avanzamento); verificare effetto sul payload ESC/POS.
- [ ] Esportare impostazioni, cancellare/modificare localmente, reimportare: verificare ripristino fedele **incluse le credenziali admin** (nota: file di backup contiene dati sensibili in chiaro, da trattare come tale nei test).
- [ ] Cambiare credenziali admin: verificare che il vecchio login non funzioni più e non venga mai scritto su Firebase.
- [ ] Cambiare etichetta dispositivo online e offline: verificare messaggi di stato coerenti (verificata / salvata solo localmente / conflitto).
- [ ] Reimpostare contatore ordini a #0001: verificare che non influisca sui contatori degli altri dispositivi.

### 6.7 Robustezza dati
- [ ] Corrompere manualmente una chiave `localStorage` (es. JSON non valido): verificare fallback al backup con avviso, non crash dell'app.
- [ ] Riempire artificialmente lo storage (quota superata): verificare messaggio "memoria piena" e invito a esportare backup, senza perdita silenziosa di dati.
- [ ] Provocare un errore JS non gestito (es. da console): verificare che il flash "errore imprevisto, dati non persi" compaia senza bloccare l'interfaccia.

### 6.8 Fuori perimetro di questo audit (da testare separatamente una volta incluso `printers-ui.js`)
- [ ] Aggiunta/rimozione stampante nel tab "Stampanti".
- [ ] Associazione categoria→stampante ed effettivo utilizzo nel flusso di stampa reale (verificare se e come si integra con `printOrderBtn`, oggi apparentemente scollegato).

---

## 7. Rischi e gap noti (da chiudere prima/durante la stabilizzazione)

### 7.1 Gap di integrazione stampanti
Il tab "Stampanti" (`printers-ui.js`) sembra un sistema di stampa parallelo non collegato al bottone "Invia e Stampa" reale, che usa solo `settings.printMethod` (dialog/rawbt). Va chiarito con chi conosce quel modulo se è: (a) una funzionalità in sviluppo non ancora integrata, (b) collegata altrove non visibile in questo file, o (c) codice morto da rimuovere prima del refactor, per evitare di portare nel nuovo frontend un sistema fantasma.

### 7.2 Incoerenza valore di default `printMethod`
Il default in-memory di `settings` è `printMethod: 'rawbt'` (riga 1031, commentato come "default del wrapper Android"), ma la `<select>` in Impostazioni elenca "Finestra di stampa di sistema (predefinito)" come prima opzione visiva. Non è un bug bloccante (il valore effettivo viene sempre da `fillSettingsForm()` che legge `settings.printMethod`), ma è fuorviante per chi legge il markup e va segnalato/commentato più chiaramente, o allineato, nel refactor.

### 7.3 Credenziali admin in chiaro
`creds = { username, password }` è confrontato in chiaro in `doLogin()`, salvato in chiaro in `localStorage`, ed **esportato in chiaro** nel backup JSON. Per un'app "da festa/evento" a basso rischio può essere una scelta pragmatica accettata consapevolmente, ma va **confermata esplicitamente come rischio accettato** (o rivista) prima del refactor, non ereditata per inerzia.

### 7.4 Nessuna vera cancellazione/anonimizzazione dati
"Chiudi cassa e azzera" è l'unico modo per ripulire lo storico e sovrascrive senza possibilità di recupero (nessun export automatico pre-azzeramento). Da valutare se il refactor debba introdurre un archivio storico persistente (multi-serata) invece dell'attuale modello "singola serata corrente".

### 7.5 Denominazione incoerente del prodotto
Il titolo pagina è "Tabby", ma chiavi di storage, nodo Firebase (`cassa-festa-2026`), messaggi utente e nome pipeline CI (`TallonciniCassa-APK`) usano ancora "talloncini-cassa"/"cassa"/"festa". Da chiarire se è un rebranding in corso: nel refactor React è l'occasione naturale per allineare naming di codice, storage keys e progetto Firebase, ma **qualsiasi rinomina delle chiavi Firebase/localStorage richiede una migrazione dati esplicita**, non un semplice "trova e sostituisci".

### 7.6 Doppio percorso di scrittura vendite su Firebase
`saveSalesLog()` (sovrascrittura totale del nodo `cassa/sales`) è usata solo per l'azzeramento in chiusura cassa, mentre `saveSaleEntry()` (update mirato) è usata in tutti gli altri casi. Coesistere è corretto per design (evita che due dispositivi si sovrascrivano a vicenda durante il servizio), ma va **testato esplicitamente** un caso limite: chiusura cassa su un dispositivo mentre un altro sta registrando una vendita nello stesso istante.

---

## 8. Piano di migrazione incrementale (proposta)

Approccio "strangler fig": il monolite resta la sorgente di verità in produzione finché ogni pezzo del nuovo frontend non è stato validato contro la checklist di regressione (§6), poi si sostituisce modulo per modulo senza mai avere un "big bang" di rilascio.

| Fase | Contenuto | Uscita (Definition of Done della fase) |
|---|---|---|
| **0 — Congelamento perimetro** | Nessuna nuova feature nel monolite (già in corso per questo task); completare l'audit includendo `printers-ui.js` e il codice nativo Android mancante | Inventario e modello dati confermati al 100% del codice esistente, gap §7.1 chiarito |
| **1 — Estrazione layer dati** | Isolare i 7 "servizi" di §5 dietro interfacce esplicite (funzioni pure/moduli), senza toccare la UI del monolite: `MenuService`, `SalesService`, `DeviceIdentityService`, `CashService`, `SettingsService`, `PrintService` (con adapter dialog/RawBT/stampanti), `SyncService` | Il monolite funziona identico a oggi ma con logica e rendering disaccoppiati; checklist §6 superata sul monolite refattorizzato |
| **2 — Contratti congelati** | Documentare come "API interne" stabili gli schemi di §3 (localStorage keys, path Firebase, payload di stampa); aggiungere validazione/normalizzazione esplicita (oggi sparsa in `normalizeSettings()`, default impliciti nei render) | Contratti versionati, nessuna scrittura Firebase/localStorage fuori dai service layer |
| **3 — Bootstrap React in parallelo** | Nuovo frontend React che consuma **gli stessi** service layer (stesso storage, stesso nodo Firebase), avviato dietro flag/route separata, non ancora esposto agli operatori reali | Parità funzionale su Cassa (flusso più critico, §4.1) verificata con checklist §6.1–6.2 |
| **4 — Migrazione vista per vista** | Ordine consigliato per rischio decrescente di regressione operativa: Cassa → Modifica ultimo ordine → Storico → Chiusura/Fondo cassa → Menu/CSV → Impostazioni → Stampanti (ultimo, dopo aver chiarito §7.1) | Ogni vista migrata supera l'intera sezione corrispondente della checklist §6 in affiancamento reale (stesso evento, entrambe le UI disponibili) |
| **5 — Dismissione monolite** | Rimozione `index.html` legacy solo dopo almeno un evento reale completo (apertura→chiusura cassa) gestito interamente dal nuovo frontend senza rollback | Nessun incidente in produzione nella finestra di osservazione concordata col cliente |

**Vincolo trasversale a tutte le fasi**: nessuna migrazione di chiavi Firebase/localStorage "in place" — se il refactor richiede di rinominare/ristrutturare uno schema (es. §7.5), si introduce un nuovo path/chiave versionata con migrazione esplicita e reversibile, mai un rename distruttivo.

---

## 9. Stato Definition of Done

| Voce DoD | Stato dopo questo documento |
|---|---|
| Funzionalità attuali inventariate e verificate | ✅ per `index.html`; ⚠️ **da completare** per `printers-ui.js` e bridge Android nativo (non forniti) |
| Modello dati documentato | ✅ (§3) |
| Flussi critici identificati | ✅ (§4), incluso l'elenco di comportamenti-limite non testabili solo leggendo il codice |
| Test manuali di regressione definiti | ✅ (§6) — da eseguire almeno una volta come baseline prima di iniziare la Fase 1 del piano |
| Nessuna nuova feature introdotta nel monolite durante la migrazione | 🔲 impegno di processo, non verificabile da questo documento — da presidiare in code review |

**Prossimo passo consigliato**: fornire `printers-ui.js` e il riferimento al progetto Android nativo per chiudere il gap di §7.1 prima di congelare definitivamente il perimetro (Fase 0).