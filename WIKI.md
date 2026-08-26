# Tabby — Guida all'utilizzo

> Guida rapida per utilizzare Tabby durante una festa/sagra.

## 1. Cos'è Tabby

Tabby è il sistema di cassa per gestire ordini, pagamenti, scontrini e stampanti termiche.

L'app può essere utilizzata su tablet Android. Le impostazioni amministrative devono essere configurate prima dell'utilizzo operativo della cassa.

---

## 2. Prima configurazione

### 2.1 Aprire l'area Admin

Dalla schermata principale aprire il menu **Admin**.

Qui sono disponibili le funzioni di configurazione, tra cui menu, stampanti, storico e chiusura cassa.

### 2.2 Configurare il menu

Prima di iniziare a prendere ordini:

1. Creare le categorie/gruppi dei prodotti.
2. Inserire i prodotti.
3. Impostare i prezzi.
4. Controllare l'ordine di visualizzazione.
5. Stabilire quali categorie devono stampare un ticket.

---

## 3. Configurazione stampanti

Aprire:

**Admin → Stampanti**

Per aggiungere una stampante:

1. Premere **Aggiungi stampante**.
2. Consentire a Tabby l'accesso ai **dispositivi nelle vicinanze** quando Android lo richiede.
3. Avviare la ricerca.
4. Selezionare la stampante trovata.
5. Configurare il tipo di collegamento.
6. Salvare.
7. Eseguire una **stampa di test**.

### Bluetooth

Su Android 12 o superiore è necessario concedere il permesso **Dispositivi nelle vicinanze**.

Se la stampante non viene trovata:

- verificare che Bluetooth sia acceso;
- verificare che la stampante sia accesa;
- verificare che non sia già collegata a un altro dispositivo;
- controllare **Impostazioni Android → App → Tabby → Autorizzazioni → Dispositivi nelle vicinanze**;
- ripetere la ricerca.

### LAN / Wi-Fi

Per una stampante di rete è necessario conoscere l'indirizzo IP della stampante.

Esempio:

`192.168.1.50`

La stampante deve essere collegata alla stessa rete del tablet e deve accettare la stampa ESC/POS sulla porta configurata dalla stampante, normalmente la porta TCP 9100.

### USB OTG

Collegare la stampante al tablet tramite un adattatore USB OTG compatibile.

Quando Android mostra la richiesta di accesso al dispositivo USB, consentire l'accesso.

---

## 4. Associare le stampanti alle categorie

Una stampante può essere assegnata a una o più categorie.

Esempio:

| Categoria | Stampante |
|---|---|
| Cucina | Stampante cucina |
| Bar | Stampante bar |
| Pizzeria | Stampante pizza |

Quando un prodotto appartiene a una categoria configurata per la stampa, il relativo ticket viene inviato alla stampante associata.

---

## 5. Impostazioni di stampa

Le impostazioni disponibili possono includere:

- numero di copie;
- stampa/non stampa per categoria;
- taglio automatico;
- apertura del cassetto;
- margine superiore;
- dimensione del numero scontrino;
- ristampa;
- coda di stampa;
- gestione degli errori;
- riconnessione della stampante.

Dopo aver modificato una configurazione è consigliato eseguire una stampa di test.

---

## 6. Utilizzo della cassa

### Nuovo ordine

1. Aprire la schermata cassa.
2. Selezionare i prodotti richiesti dal cliente.
3. Controllare quantità e totale.
4. Selezionare il metodo di pagamento.
5. Confermare l'ordine.

Se una categoria è configurata per la stampa, il relativo ticket viene inserito nella coda di stampa.

---

## 7. Contanti

Quando il cliente paga in contanti:

1. Controllare il totale.
2. Inserire l'importo ricevuto.
3. Calcolare il resto.
4. Consegnare il resto al cliente.
5. Confermare il pagamento.

Il movimento viene registrato nella cassa e sarà disponibile nei dati di chiusura.

---

## 8. Fondo cassa e aggiunte di contante

Il **fondo cassa** rappresenta il denaro iniziale presente nel cassetto.

Eventuali ulteriori somme aggiunte durante la serata devono essere registrate tramite la funzione dedicata.

Alla chiusura sarà possibile distinguere il fondo iniziale dalle successive aggiunte.

---

## 9. Storico scontrini

Aprire:

**Admin → Storico**

Lo storico permette di consultare gli scontrini registrati e, quando previsto dalla configurazione, visualizzarne i dettagli e procedere alla ristampa.

Lo storico è utile anche per controllare gli incassi e verificare eventuali errori durante la serata.

---

## 10. Ristampare uno scontrino

Dallo storico:

1. individuare lo scontrino;
2. aprire il dettaglio;
3. scegliere **Ristampa**;
4. selezionare/confermare la stampante;
5. attendere la stampa.

La ristampa non deve essere utilizzata per creare un nuovo ordine: serve solamente a riprodurre un ticket già registrato.

---

## 11. Chiusura cassa

A fine serata aprire:

**Admin → Chiusura cassa**

Controllare:

- totale incassato;
- incasso in contanti;
- altri metodi di pagamento configurati;
- fondo cassa iniziale;
- aggiunte di contante;
- eventuali differenze.

Eseguire la procedura di chiusura solo dopo aver terminato gli ordini della serata.

---

## 12. Problemi con la stampante

### La stampante non compare

Controllare nell'ordine:

1. stampante accesa;
2. collegamento corretto;
3. Bluetooth/Wi-Fi/USB attivo;
4. permessi Android concessi;
5. stampante non occupata da un altro dispositivo;
6. indirizzo IP corretto se si utilizza LAN;
7. ripetere la ricerca.

### La stampante compare ma non stampa

1. Aprire **Admin → Stampanti**.
2. Selezionare la stampante.
3. Eseguire una stampa di test.
4. Controllare lo stato della connessione.
5. Verificare carta, coperchio e alimentazione.
6. Per LAN verificare che tablet e stampante siano sulla stessa rete.

### Bluetooth autorizzato ma nessun dispositivo trovato

Verificare:

- **Impostazioni Android → App → Tabby → Autorizzazioni → Dispositivi nelle vicinanze → Consenti**;
- Bluetooth acceso;
- stampante accesa;
- distanza ridotta tra tablet e stampante;
- eventuale associazione Bluetooth precedente;
- riavvio della stampante e nuova ricerca.

Se il problema persiste, controllare i log diagnostici di Tabby/Android.

---

## 13. Regola d'oro prima della serata

Prima di iniziare la festa verificare sempre:

- [ ] Menu configurato
- [ ] Prezzi controllati
- [ ] Categorie controllate
- [ ] Stampanti collegate
- [ ] Stampante assegnata a ogni categoria necessaria
- [ ] Stampa di test eseguita
- [ ] Carta sufficiente
- [ ] Fondo cassa registrato
- [ ] Tablet alimentato
- [ ] Rete Wi-Fi verificata per le stampanti LAN
- [ ] Bluetooth verificato per le stampanti Bluetooth

---

## 14. Configurazione consigliata per più casse

Quando vengono utilizzati più tablet/casse, mantenere identiche le configurazioni comuni:

- menu;
- categorie;
- prezzi;
- impostazioni di stampa;
- collegamenti alle stampanti condivise;
- regole di stampa.

Cambiare solamente ciò che deve essere specifico della singola cassa, come il **nome della cassa** o eventuali stampanti locali.

---

## 15. Glossario rapido

**Categoria** — gruppo di prodotti, ad esempio Bar, Cucina o Pizza.

**Ticket** — stampa destinata al reparto che deve preparare un prodotto.

**Scontrino** — documento riepilogativo dell'ordine.

**Stampante predefinita** — stampante utilizzata quando non è specificata una stampante diversa.

**ESC/POS** — protocollo/comando comunemente utilizzato dalle stampanti termiche POS.

**Coda di stampa** — elenco dei lavori che devono ancora essere inviati alle stampanti.

**Ristampa** — nuova stampa di un documento già registrato, senza creare un nuovo ordine.

---

## 16. Procedura rapida per l'operatore

Se sei semplicemente l'operatore della cassa:

```text
1. Apri Tabby
2. Controlla che la cassa sia pronta
3. Prendi l'ordine
4. Controlla il totale
5. Ricevi il pagamento
6. Conferma
7. Controlla eventuali ticket
8. Consegna/rilascia quanto previsto
```

**Non modificare le impostazioni Admin durante il servizio**, salvo necessità.
