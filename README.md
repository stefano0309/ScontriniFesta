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

## Stampa Bluetooth
L'app intercetta gli URL `rawbt:` generati dalla web app e li passa a RawBT.
Quindi sul tablet:
1. Installa RawBT Print Service.
2. Abbina la stampante Bluetooth in RawBT.
3. Avvia Talloncini Cassa.
4. In Impostazioni > Metodo di stampa lascia/seleziona RawBT.

## Compilazione
Apri questa cartella con Android Studio e fai:
Build > Build APK(s)

APK debug:
app/build/outputs/apk/debug/app-debug.apk

Il progetto usa Android Gradle Plugin 8.7.3, compileSdk 35 e minSdk 23.
