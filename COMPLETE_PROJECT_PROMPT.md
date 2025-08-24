# 🚗 PROMPT COMPLETO PER RICREARE IL CAR RENTAL BOT

## 🎯 OBIETTIVO FINALE
Creare un bot Node.js che monitora automaticamente le offerte di noleggio auto a lungo termine dai migliori siti di noleggio, filtra le offerte secondo criteri configurabili, e invia notifiche Discord formattate con le migliori offerte organizzate per marca e modello.

## 📋 TASK LIST COMPLETA

### 1. SETUP INIZIALE PROGETTO
- [ ] Creare directory `car-rental-bot`
- [ ] Inizializzare progetto Node.js con `npm init -y`
- [ ] Installare dipendenze: `npm install playwright axios dotenv node-cron winston`
- [ ] Creare struttura cartelle:
  ```
  src/
  ├── config.js
  ├── index.js
  ├── scheduler.js
  ├── parsers/
  │   ├── baseParser.js
  │   └── alphabetParser.js
  │   └── arvalParser.js
  │   └── ayvensParser.js
  │   └── rentagoParser.js
  ├── scrapers/
  │   └── carScraper.js
  └── utils/
      ├── browser.js
      ├── discordNotifier.js
      ├── dataManager.js
      └── logger.js
  data/
  logs/
  html-card/
  ├── esempio-card-sito-ayvens.html
  ├── esempio-card-sito-leasys.html
  ├── esempio-card-sito-rentago.html
  ├── esempio-paging-sito-leasys.html
  └── esempio-paging-sito-rentago.html
  ```

### 2. CONFIGURAZIONE AMBIENTE
- [ ] Creare file `.env.example` con template configurazione
- [ ] Creare file `.env` per configurazione effettiva
- [ ] Implementare `src/config.js` per lettura variabili ambiente con parsing array

#### Variabili ambiente richieste:
```env
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/ID/TOKEN
MIN_PRICE=100
MAX_PRICE=350
MIN_DURATION_MONTHS=48
EXCLUDED_BRANDS=AIXAM,ALFA ROMEO,CHATENET,CUPRA,DACIA,DS,IVECO,JAECOO,JEEP,KYMCO,LAND ROVER,LEAPMOTOR,LYNK,OMODA,MINI,PIAGGIO,POLESTAR,SMART,SUZUKI,YAMAHA
EXCLUDED_MODELS=
INCLUDED_MODELS=
CRON_SCHEDULE=0 8 * * *
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36
HEADLESS=false
DELAY_MIN_MS=1000
DELAY_MAX_MS=3000
LOG_LEVEL=debug
LOG_TO_FILE=false
```

### 3. SISTEMA DI LOGGING
- [ ] Implementare `src/utils/logger.js` con logging duale (console + file opzionale)
- [ ] Supporto parametro `LOG_TO_FILE` per abilitare scrittura su file
- [ ] Se `LOG_TO_FILE=true`:
  - Creazione automatica directory `logs/`
  - Nome file formato: `car-rental-bot-YYYY-MM-DD_HH-MM-SS.log`
  - Esempio: `car-rental-bot-2025-08-25_00-12-59.log`
  - Logging ANCHE su file (mantiene output console)
  - Formato log: `[timestamp ISO] [LEVEL] messaggio`
- [ ] Livelli: debug, info, warn, error
- [ ] Metodi compatibili con chiamate async esistenti
- [ ] Gestione chiusura pulita del file log su exit/SIGINT/SIGTERM

### 4. GESTIONE BROWSER PLAYWRIGHT
- [ ] Implementare `src/utils/browser.js` 
- [ ] Configurazione anti-detection:
  - User agent customizzabile
  - Modalità headless/visible configurabile
  - Delay randomici tra azioni
  - Gestione viewport e contesto browser
- [ ] Metodi per creazione e chiusura browser

### 5. PARSER BASE E AYVENS
- [ ] Implementare `src/parsers/baseParser.js` con:
  - Metodi comuni per validazione offerte
  - Gestione popup cookie con selettori multipli
  - Estrazione prezzi e durate con parsing numerico robusto
  - Normalizzazione brand/model
  - **LOGICA FILTRI CON PRIORITÀ**:
    1. Se `INCLUDED_MODELS` riempito → passa solo se modello inizia con uno dei valori
    2. Se `INCLUDED_MODELS` vuoto → applica `EXCLUDED_BRANDS` e `EXCLUDED_MODELS`
  - Utility per wait, click, text extraction sicure

- [ ] Implementare `src/parsers/ayvensParser.js` che estende baseParser:
  - URL: `https://noleggio.ayvens.com/it-it/noleggio-lungo-termine/`
  - **INFINITY SCROLL**: implementare `loadAllOffers()` per caricare tutte le ~273 offerte
  - Selettori DOM:
    - Cards: `.vetrina-card, .offer-card, [class*="vetrina"]`
    - Titolo: `.vetrina-titolo, .offer-title, h3, h4`
    - Prezzo: `.vetrina-prezzo, .offer-price, [class*="prezzo"]`
    - Info: `.vetrina-info, .offer-info, [class*="info"]`
  - Estrazione dati:
    - Brand: prima parola del titolo
    - Model: resto del titolo dopo brand
    - Price: parsing numerico da stringa prezzo
    - Anticipo: estrazione da testo info se presente
    - Duration: estrazione mesi da info
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser leasys che estende baseParser:
	- Url:  https://e-store.leasys.com/it/italiano/business 
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista con i filtri a sinistra e il paging infondo quindi devi navigare tutte le pagine prendendo le offerte di ogni pagina.
	- Non interagire con i filtri di sinistra ma tira fuori tutte le offerte e le filtri dopo quando parsi tutte le card estratte navigando tutte le pagine.
	- il paging è fatto come questo frammento html che ti riporto qui @.\html-card\esempio-paging-sito-leasys.html
	- tiri fuori quindi i selettori/link per navigare tutte le offerte di tutte le pagine
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-leasys.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Maserati il modello è "Maserati Grecale 2.0 250cv MHEV GT Q4 auto" importo 903€ al mese, Anticipo 2.500 € durata  36 Mesi.
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser rentago che estende baseParser:
	- Url:  https://www.rentago.it/noleggio-a-lungo-termine/?p0=toscana&p1=rata-a-{MAX_PRICE}
	- al posto di {MAX_PRICE} devi mettere il valore del config MAX_PRICE, quindi ad esempio se MAX_PRICE=350 l'url diventa https://www.rentago.it/noleggio-a-lungo-termine/?p0=toscana&p1=rata-a-350
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista con il paging infondo quindi devi navigare tutte le pagine prendendo le offerte di ogni pagina.
	- il paging è fatto come questo frammento html che ti riporto qui @.\html-card\esempio-paging-sito-rentago.html che mostra 4 pagine.
	- tiri fuori quindi i selettori/link per navigare tutte le offerte di tutte le pagine
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-rentago.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Fiat il modello è "Panda - Pandina" importo "169€" al mese. in queste card non trovi l'indicazione di Anticipo e durata quindi non li considerare ne per il messaggio ne per filtrare o scartare le offerte con questi due parametri.
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti
	
- [ ] Implementare il parser alphabet che estende baseParser:
	- Url:  https://www.alphabet.com/it-it/offerte-di-noleggio-lungo-termine
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-alphabet.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca BMW il modello è "BMW SERIE 1 118d MSport Pro 150 CV automatic" importo "399€" al mese durata "36 mesi" e anticipo: 1.229€
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.
	
- [ ] Implementare il parser driveflee che estende baseParser:
	- Url:  https://driveflee.com/noleggio-a-lungo-termine/
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-driveflee.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Fiat il modello è "Fiat Panda 1.0 firefly hybrid s&s 70cv 5p.ti" importo "119€" al mese durata "48 mesi" e "Anticipo: 2.500 €"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.
	
- [ ] Implementare il parser noleggiosemplice che estende baseParser:
	- Url:  https://www.noleggiosemplice.it/noleggio-lungo-termine
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-noleggiosemplice.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Fiat il modello è "Fiat Panda 1.0 70 Cv S&S Hybrid" importo "169€" al mese durata "36 mesi" e "Anticipo €4000"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.
	
- [ ] Implementare il parser syntonia che estende baseParser:
	- Url:  https://www.syntonia.biz/noleggio-lungo-termine
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-syntonia.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Toyota il modello è "Toyota Aygo X 1.0 VVT-i 72 CV 5p. Active" importo "€185" al mese durata "36 mesi" e "Anticipo €3500"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser facile che estende baseParser:
	- Url:  https://www.facile.it/noleggio-lungo-termine-partita-iva.html?sort=monthlyFee
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-facile.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Toyota il modello è "Toyota Aygo X" importo "€141" al mese durata "36 mesi" e "Anticipo 4.099€"
	- Attenzione esistono delle card anche che scrivono "usato" oppure "consegna veloce" o entrambe le voci e nella prima stesura del codice prendevi qui nomi come nomi marca ti passa la card offerta di questa casistica qui @.\html-card\esempio-card-sito-facile-usato.html qui trovi un offerta con marca JEEP il modello è "Jeep Compass" importo "€241" al mese durata "24 mesi" e "Anticipo 4.098€"
	- Attenzione esistono delle card anche che scrivono "PROMO DEL MESE" ti passo la card offerta di questa casistica qui @.\html-card\esempio-card-sito-facile-promo.html qui trovi un offerta con marca Toyota il modello è "Toyota Yaris Cross" importo "241€" al mese durata "36 mesi" e "Anticipo 4.098€". Controlla quando c'è questa offerta del mese nella card e mettimi un icona quando mandi il messaggio discord cosi che mi accorga che è una promo. La promo la possono scrivere anche cosi con il testo "Offerta esclusiva Facile.it" ti passo anche per quesot caso la card offerta di questa casistica qui @.\html-card\esempio-card-sito-facile-offerta-esclusiva.html qui trovi un offerta con marca Toyota il modello è "TOYOTA C-HR" importo "239€" al mese durata "36 mesi" e "Anticipo 4.098€". Controlla quando c'è questa offerta del mese nella card e mettimi un icona quando mandi il messaggio discord cosi che mi accorga che è una promo.
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser noleggiare che estende baseParser:
	- Url:  https://www.noleggiare.it/it/noleggio-lungo-termine/auto-nuove/
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-noleggiare.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca FIAT il modello è "FIAT PANDA" importo "€ 159" al mese durata "36 mesi" e "Anticipo € 2990"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser clarisrent che estende baseParser:
	- Url:  https://clarisrent.it/it/nlt-aziende
	- a quella pagina c'è intanto da accettare il cookie 
	- poi c'è una lista ma in questa lista NON c'è il paging quindi puoi prendere solo le offerte presenti in questa pagina.	
	- appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-clarisrent.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca FIAT il modello è "FIAT DUCATO" importo "405€" al mese durata "48 mesi" e "Anticipo: € 5.000€"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

- [ ] Implementare il parser yoyomove che estende baseParser:
	- Url: https://www.yoyomove.com/it/offerte-noleggio-lungo-termine-aziende/?database_id=g_it_search_generic_nlt_exact
	- a quella pagina c'è intanto da accettare il cookie. Il pulsante specifico è <button class="qc-cmp2-close-icon" aria-label="RIFIUTA TUTTO">.
	- fai attenzione anche alla navigazione delle pagine perché il problema principale è che il popup cookie blocca i click sui link di paginazione.
	- poi c'è una lista con il paging infondo quindi devi navigare tutte le pagine prendendo le offerte di ogni pagina.
	- il paging è fatto come questo frammento html che ti riporto qui @.\html-card\esempio-paging-sito-yoyomove.html che mostra 5 pagine ma attenzione le pagine totali sono di più infatti nell'ultimo link del paging troverai che sono 10 totali quindi le devi navigare tutte.
	- tiri fuori quindi i selettori/link per navigare tutte le offerte di tutte le pagine
	- 1. Click fuori dal banner: Tentativo di click su body alle coordinate (50,50)
	  - Rimozione JavaScript aggressiva: Rimuove tutto il container #qc-cmp2-container
	  - Verifica continua: Controlla che il popup sia effettivamente sparito
	  2. Navigazione Paginazione Robusta:
	  - Rimozione preventiva popup: Prima di ogni click, verifica e rimuove eventuali popup
	  - Multipli metodi di click:
		a. Click normale
		b. Click forzato ({ force: true })
		c. Click via JavaScript
	  - Navigazione diretta: Se i click falliscono, naviga direttamente tramite URL
	  - Verifica successo: Controlla che l'URL sia effettivamente cambiato
	  3. Metodo ensureCookiePopupRemoved():
	  - Chiamato prima di ogni navigazione
	  - Rimuove forzatamente tutti gli elementi qc-cmp
	  - Riabilita i pointer-events su body e html
	  - Rimuove overlay che potrebbero bloccare i click
	  4. Selettori paginazione specifici:
	   Basati sull'HTML che hai fornito:
	   - a.pagination__page-link--next (pulsante freccia "avanti")
	   - a.pagination__page[data-page-target="${currentPage + 1}"] (pagina specifica)
	   - Navigazione diretta con URL pattern corretto
	   - appena hai tirato fuori tutte le offerte le scremi/filtri dopo quando parsi tutte le card estratte.
	  5. Devi implementare una migliore logica per rilevare la fine della paginazione e non continuare dopo l'ultima.Puoi usare il trucco di leggere l'ultimo link della paginazione >> quando sei a pagina=1 e quello dovrebbe darti il numero di pagine totali vedi esempio nel file che ti ho allegato. In alternativa (scegli te il metodo + robusto) puoi anche implementare una Logica di terminazione intelligente:
		- Condizione 1 - Pagine vuote consecutive:
		- Se trova 2 pagine consecutive senza offerte valide → STOP
		- Reset del contatore quando trova offerte
		Condizione 2 - Link paginazione:
		  - Se non esiste link per pagina successiva → STOP
		  - Se pulsante "next" è disabilitato/nascosto → STOP

		  Condizione 3 - Limite massimo pagine:
		  - Se raggiunge pagina 15 → STOP per sicurezza
		  - Se currentPage >= maxPage (dal link ultima pagina) → STOP

		  Condizione 4 - Fallimento navigazione:
		  - Se tutti i metodi di navigazione falliscono → STOP		
	- Ti metto un esempio di card offerta qui @.\html-card\esempio-card-sito-yoyomove.html dal quale puoi tirare fuori i selettori in quanto dentro questo file trovi un offerta con marca Fiat il modello è "Fiat Panda 1.0 FireFly Hybrid 70cv" importo "135€" al mese durata "36 mesi" e "Anticipo: 3.500€"
	- Metti i log verbosi in modo che in caso di problemi si possa fare debug bene e vedere il punto dove si rompe.
	- Esegui il test cosi puoi verificare che tutto funzioni altrimenti autocorreggerti a ritesta fino al successo o dopo 3/4 tentativi chiedi a me che fare.

### 6. SCRAPER PRINCIPALE
- [ ] Implementare `src/scrapers/carScraper.js`:
  - Orchestrazione scraping singolo sito
  - Gestione errori e retry logic
  - Raggruppamento offerte per brand/model
  - Selezione migliore offerta per prezzo
  - Supporto parametro `--sites` per scraping selettivo

### 7. NOTIFICHE DISCORD CON SPLITTING MESSAGGI
- [ ] Implementare `src/utils/discordNotifier.js` con:
  - `sendOffers()`: invio messaggi multipli con delay anti-rate-limit
  - `formatMultipleMessages()`: divisione offerte in chunk per evitare limite 6000 caratteri
  - `calculateMaxBrandsPerMessage()`: stima ottimale brand per messaggio
  - `formatSingleMessage()`: formattazione embed Discord con:
    - Titolo dinamico "Parte X/Y" per messaggi multipli
    - Descrizione con statistiche complete/parziali
    - Campi per ogni brand con modelli ordinati per prezzo
	- se offerta non era presente prima di questo modello mettere icona new
	- se prezzo aumentato rispetto al precedente mettere icona/carattere rosso freccia su e +€xx,xx, se diminuita verde freccia giu e -€xx,xx, se uguale non aggiungere niente.
    - Supporto anticipo in formato "(anticipo €XXX)"
	- stampi il portale da dove hai preso offerta (es.: alphabet, rentago, etc..) in quanto se lanci il bot con più portali poi non so l'offerta nel messaggio a quale portale si riferisce.
    - Footer con criteri filtraggio
  - `sendError()` e `sendStartupMessage()` per notifiche stato

### 8. GESTIONE DATI E STORICO
- [ ] Implementare `src/utils/dataManager.js`:
  - Salvataggio offerte JSON con timestamp
  - Confronto offerte precedenti per novità o cambio prezzo
  - Pulizia automatica dati vecchi (30 giorni)
  - Statistiche sessione scraping

### 9. SCHEDULING E ENTRY POINT
- [ ] Implementare `src/scheduler.js` con node-cron
- [ ] Implementare `src/index.js` con CLI arguments:
  - `--manual`: esecuzione una volta senza scheduler
  - `--sites <lista>`: selezione siti specifici (supporto alias)
  - `--help`: help integrato
  - Modalità default: avvio scheduler automatico

### 10. SCRIPT E CONFIGURAZIONI
- [ ] Aggiornare `package.json` con scripts:
  ```json
  {
    "scripts": {
      "start": "node src/index.js",
      "manual": "node src/index.js --manual",
      "test-discord": "node src/index.js --test-discord",
      "help": "node src/index.js --help",
      "dev": "nodemon src/index.js"
    }
  }
  ```

### 11. DOCUMENTAZIONE COMPLETA
- [ ] Creare `README.md` con:
  - Descrizione funzionalità e siti monitorati
  - Istruzioni installazione completa (incluso `npx playwright install`)
  - Setup Discord webhook
  - Esempi utilizzo CLI
  - Configurazione filtri avanzati
  - Troubleshooting comune
  - Struttura progetto
  - Changelog con versioni

### 12. TESTING E VALIDAZIONE FINALE
- [ ] Test completo funzionalità:
  - Scraping Ayvens con infinity scroll (tutte le 273+ offerte)
  - Filtri INCLUDED_MODELS prioritario
  - Filtri EXCLUDED_BRANDS/EXCLUDED_MODELS secondari
  - Splitting messaggi Discord per 80+ offerte
  - CLI parameters con --sites e --manual
  - Scheduler automatico con cron
- [ ] Verifica error handling robusto
- [ ] Test configurazioni edge case (tutti filtri vuoti, solo included, etc.)

## 🔧 SPECIFICHE TECNICHE DETTAGLIATE

### LOGICA FILTRI PRIORITÀ (CRITICA)
```javascript
if (includedModels.length > 0) {
  // PRIORITÀ 1: passa solo se modello INIZIA con uno dei valori
  modelValid = includedModels.some(included => 
    offer.model.toUpperCase().startsWith(included)
  );
  // Ignora completamente excludedBrands e excludedModels
} else {
  // PRIORITÀ 2: applica entrambi i filtri excluded
  brandValid = !excludedBrands.includes(offer.brand.toUpperCase());
  modelValid = !excludedModels.some(excluded => 
    offer.model.toUpperCase().startsWith(excluded)
  );
}
```

### INFINITY SCROLL AYVENS (ESSENZIALE)
- Implementare loop che:
  1. Scrolla fino in fondo alla pagina
  2. Cerca pulsante "Carica altro" o "Load more"
  3. Clicca se presente e attende caricamento
  4. Ripete fino a catturare tutte le 273+ offerte
  5. Parsing finale di tutte le card caricate

### DISCORD MESSAGE SPLITTING (CRITICO)
- Calcolo dinamico caratteri per brand
- Divisione intelligente per non superare 6000 caratteri
- Titoli "Parte X/Y" per messaggi multipli
- Delay 1 secondo tra invii per evitare rate limit
- Gestione errori per singoli messaggi

### STRUTTURA DATI OFFERTE
```javascript
{
  "FIAT": {
    "PANDA": {
      "bestOffer": {
        "price": 149,
        "duration": 48,
        "anticipo": "€2000",
        "site": "Ayvens",
        "url": "..."
      },
      "allOffers": [/* array offerte ordinate per prezzo */]
    }
  }
}
```

### CLI ARGUMENTS SUPPORTATI
- `node src/index.js` → Scheduler automatico
- `node src/index.js --manual` → Scraping una volta
- `node src/index.js --manual --sites ayvens` → Solo Ayvens
- `node src/index.js --help` → Help completo

## ⚠️ PUNTI CRITICI DA NON DIMENTICARE

1. **INFINITY SCROLL**: Senza questo, catturi solo 30-40 offerte invece di 273+
2. **FILTRI PRIORITÀ**: INCLUDED_MODELS deve vincere su EXCLUDED quando riempito
3. **DISCORD SPLITTING**: Obbligatorio per 80+ offerte, altrimenti errore 400
4. **PLAYWRIGHT INSTALL**: `npx playwright install` necessario per funzionamento
5. **ANTI-DETECTION**: User agent, delay, headless configurabili per evitare blocchi
6. **ERROR HANDLING**: Robusto su ogni operazione per stabilità 24/7
7. **SELETTORI MULTIPLI**: Per robustezza se Ayvens cambia DOM
8. **BRAND PARSING**: Solo prima parola del titolo per brand, resto per modello

## 📊 RISULTATO FINALE ATTESO

Un bot completamente automatico che:
- Monitora Ayvens 24/7 con scheduling configurabile
- Cattura TUTTE le offerte (273+) con infinity scroll
- Filtra con logica prioritaria configurabile via .env
- Invia notifiche Discord multi-messaggio formattate
- Gestisce errori e continua funzionamento
- CLI flessibile per testing e operazioni manuali
- Logging completo per monitoring e debug
- Codice modulare e facilmente estendibile

## 🎯 COMANDO DI VERIFICA FINALE
```bash
node src/index.js --manual
```
Dovrebbe:
1. Caricare tutte le 273+ offerte da Ayvens
2. Applicare filtri configurati
3. Inviare 2-4 messaggi Discord con offerte raggruppate
4. Loggare statistiche complete senza errori