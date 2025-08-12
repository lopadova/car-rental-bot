# 🚗 PROMPT COMPLETO PER RICREARE IL CAR RENTAL BOT

## 🎯 OBIETTIVO FINALE
Creare un bot Node.js che monitora automaticamente le offerte di noleggio auto a lungo termine dal sito Ayvens, filtra le offerte secondo criteri configurabili, e invia notifiche Discord formattate con le migliori offerte organizzate per marca e modello.

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
  │   └── ayvensParser.js
  ├── scrapers/
  │   └── carScraper.js
  └── utils/
      ├── browser.js
      ├── discordNotifier.js
      ├── dataManager.js
      └── logger.js
  data/
  logs/
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
```

### 3. SISTEMA DI LOGGING
- [ ] Implementare `src/utils/logger.js` con winston
- [ ] Configurare rotazione log giornaliera in cartella `logs/`
- [ ] Livelli: debug, info, warn, error
- [ ] Format con timestamp e colori per console

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
    - Supporto anticipo Ayvens in formato "(anticipo €XXX)"
    - Footer con criteri filtraggio
  - `sendError()` e `sendStartupMessage()` per notifiche stato

### 8. GESTIONE DATI E STORICO
- [ ] Implementare `src/utils/dataManager.js`:
  - Salvataggio offerte JSON con timestamp
  - Confronto offerte precedenti per novità
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