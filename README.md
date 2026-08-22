# Talloncini Cassa — Android Wrapper

Questo progetto trasforma `talloncini-cassa-5.html` in una vera app Android tramite WebView.

## Cosa mantiene
- Interfaccia cassa e area amministrazione.
- Menu, categorie e menu/combo.
- localStorage per menu, impostazioni, contatore e registro vendite.
- Import/export impostazioni JSON.
- Import CSV.
- Chiusura cassa.
- Stampa ESC/POS tramite RawBT.
- Modalità landscape e interfaccia a schermo quasi intero.

## Storico scontrini
Nell'area amministrazione, tab **🧾 Storico**:
- Elenco completo degli scontrini emessi, con ricerca per numero e filtro per intervallo di date.
- Statistiche di riepilogo (numero scontrini, incasso, scontrino medio).
- **Dettaglio scontrino**: righe, note per prodotto, totale.
- **Ristampa scontrino** dallo storico, con la stessa pipeline di stampa della cassa (rispetta il metodo configurato — RawBT o dialogo di sistema — la valuta e la larghezza carta impostati).
- **Annulla / Ripristina ordine**: per uno scontrino battuto male o un errore, l'ordine può essere annullato (con motivo facoltativo) senza cancellarlo — resta visibile nello storico per controllo, ma esce dai totali, dalla chiusura cassa e da tutti i riepiloghi. È sempre possibile ripristinarlo in caso di annullamento per sbaglio.
- **Rilevamento numeri duplicati**: se due dispositivi assegnano per errore lo stesso numero scontrino (es. entrambi offline nello stesso momento), lo storico li segnala con un badge "⚠ DOPPIO" così il gestore può intervenire.
- Lo Storico funziona anche **completamente offline**: legge dal registro vendite locale del dispositivo, non solo da Firebase, quindi resta consultabile anche senza connessione alla festa.

## Uso multi-dispositivo e modalità offline
- Ogni cassa (tablet/telefono) ha un proprio ID dispositivo persistente: le vendite di dispositivi diversi non si sovrascrivono mai a vicenda, anche registrando ordini nello stesso istante o offline.
- Se un dispositivo non trova connessione a Firebase (es. wifi instabile durante la festa), l'app **continua a funzionare in locale** e **ritenta automaticamente la riconnessione** in background: appena la rete torna disponibile, si riaggancia da sola e sincronizza le vendite registrate nel frattempo, senza bisogno di ricaricare la pagina.
- Numerazione scontrini tramite contatore condiviso su Firebase (coordinato tra i dispositivi quando online); in caso entrambi i dispositivi siano offline nello stesso periodo, resta la possibilità di una collisione di numero — gestita e segnalata tramite il rilevamento duplicati descritto sopra.

## Stampa Bluetooth
L'app intercetta gli URL `rawbt:` generati dalla web app e li passa a RawBT.
Quindi sul tablet:
1. Installa RawBT Print Service.
2. Abbina la stampante Bluetooth in RawBT.
3. Avvia Talloncini Cassa.
4. In Impostazioni > Metodo di stampa lascia/seleziona RawBT.

## Esecuzione dell'app

### Come app Android (wrapper WebView)
1. Compila e installa l'APK (vedi sezione "Compilazione" sotto) oppure apri direttamente `talloncini-cassa-5.html` in un browser sul dispositivo, se non hai ancora generato il wrapper.
2. Al primo avvio, apri l'area amministrazione e configura in **Impostazioni**: nome attività, valuta, larghezza carta, metodo di stampa (RawBT o dialogo di sistema) e credenziali admin.
3. Se usi più dispositivi in contemporanea (es. cassa + postazione ordini), assicurati che tutti puntino allo stesso progetto Firebase già configurato nel file (nessuna configurazione aggiuntiva richiesta lato app): la sincronizzazione tra dispositivi avviene automaticamente quando la rete è disponibile.
4. In mancanza di rete, l'app resta pienamente utilizzabile: menu, stampa e registrazione vendite continuano a funzionare in locale e si sincronizzano da sole al ritorno della connessione.

### Direttamente da browser (senza wrapper, es. per test rapidi)
`talloncini-cassa-5.html` è un file autonomo (HTML + CSS + JavaScript): può essere aperto anche direttamente in un browser desktop o mobile per test, senza bisogno del wrapper Android. In questo caso la stampa RawBT via intent Android non è disponibile: usare il metodo di stampa "dialogo di sistema" nelle Impostazioni.

## Compilazione
Apri questa cartella con Android Studio e fai:
Build > Build APK(s)

APK debug:
app/build/outputs/apk/debug/app-debug.apk

Il progetto usa Android Gradle Plugin 8.7.3, compileSdk 35 e minSdk 23.