# 🚗 Car Rental Bot

Bot automatico per il monitoraggio delle offerte di noleggio auto a lungo termine su Discord.

## 📋 Descrizione

Il Car Rental Bot monitora automaticamente le offerte di noleggio a lungo termine sui principali siti italiani e invia notifiche Discord con le migliori offerte del giorno, organizzate per marca e modello.

### 🌐 Siti Monitorati

- **Ayvens** - Noleggio lungo termine (ex-Arval)
- **Alphabet** - Fleet management e noleggi
- **Leasys** - Noleggio lungo termine FCA
- **Rentago** - Piattaforma noleggi online
- **DriveFlee** - Piattaforma noleggi long term
- **YoyoMove** - Noleggio lungo termine con offerte business

## ✨ Caratteristiche

- 🔍 **Scraping intelligente** con parsing DOM modulare
- 🤖 **Anti-detection** con user agent rotazione e delay randomici
- 📊 **Raggruppamento smart** per marca/modello con prezzi migliori
- 📱 **Notifiche Discord** con embed formattati e ricchi
- ⏰ **Scheduling automatico** con cron jobs configurabili
- 💾 **Storico dati** con statistiche e cleanup automatico
- 🛡️ **Error handling** robusto con retry logic
- 📋 **Logging completo** su file e console

## 🚀 Installazione

### Prerequisiti

- **Node.js** >= 16.0.0
- **npm** (incluso con Node.js)
- Account **Discord** con permessi per creare webhook

### 1. Clone del repository

```bash
git clone https://github.com/username/car-rental-bot.git
cd car-rental-bot
```

### 2. Installazione dipendenze

```bash
npm install
```

### 3. Installazione browser Playwright

```bash
npx playwright install
```
⚠️ **IMPORTANTE**: Questo comando scarica i browser necessari per Playwright (~200MB). È obbligatorio per il funzionamento del bot.

### 4. Configurazione

1. Copia il file di esempio:
```bash
copy .env.example .env
```

2. Modifica il file `.env` con i tuoi parametri:

```env
# Discord Configuration
DISCORD_WEBHOOK_URL=https://discord.com/api/webhooks/YOUR_WEBHOOK_ID/YOUR_WEBHOOK_TOKEN

# Scraping Configuration
MIN_PRICE=100
MAX_PRICE=350
MIN_DURATION_MONTHS=48

# Scheduling Configuration (cron format: minute hour * * *)
CRON_SCHEDULE=0 8 * * *

# Anti-bot Configuration
USER_AGENT=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36
HEADLESS=true
DELAY_MIN_MS=1000
DELAY_MAX_MS=3000

# Logging
LOG_LEVEL=info
```

### 5. Setup Discord Webhook

1. Vai sul tuo server Discord
2. Impostazioni Server → Integrazioni → Webhook
3. Crea Nuovo Webhook
4. Copia l'URL e inseriscilo nel file `.env`

## 🎮 Utilizzo

### Avvio Automatico (Scheduler)

**Windows:**
```bash
# Doppio click su start-bot.bat
# oppure
start-bot.bat
```

**Cross-platform:**
```bash
npm start
# oppure
node src/index.js
```

### ⚡ Modalità Manuale

#### Scraping Immediato
Esegui scraping + Discord una volta e termina:
```bash
npm run manual
# oppure
node src/index.js --manual
```

#### Test Solo Discord
Testa la connessione Discord:
```bash
npm run test-discord
# oppure  
node src/index.js --test-discord
```

### 🎯 Selezione Siti Specifici

#### Tutti i parametri accettano `--sites` o `-s`:

**Scraping solo Ayvens e Leasys:**
```bash
node src/index.js --manual --sites ayvens,leasys
# oppure
node src/index.js --manual -s ayv,leas
```

**Scraping solo Leasys:**
```bash
node src/index.js --manual --sites leasys
# oppure abbreviato
node src/index.js --manual -s leas
```

**Siti disponibili:**
- `ayvens` (alias: `ayv`, `arv`)
- `alphabet` (alias: `alpha`, `alph`)
- `leasys` (alias: `leas`)
- `rentago` (alias: `rent`, `renta`)
- `driveflee` (alias: `drive`, `flee`)
- `yoyomove` (alias: `yoyo`, `move`)

### 📋 Help Integrato

Visualizza tutti i comandi disponibili:
```bash
npm run help
# oppure
node src/index.js --help
# oppure
node src/index.js help
```

### 🛠️ Modalità Sviluppo

Con auto-reload per modifiche al codice:
```bash
npm run dev
```

## 📁 Struttura del Progetto

```
car-rental-bot/
├── src/
│   ├── config.js                 # Configurazioni globali
│   ├── index.js                  # Entry point principale
│   ├── scheduler.js              # Gestione cron jobs
│   ├── parsers/                  # Parser HTML per ogni sito
│   │   ├── baseParser.js         # Classe base parser
│   │   ├── ayvensParser.js       # Parser Ayvens (ex-Arval)
│   │   ├── alphabetParser.js     # Parser Alphabet
│   │   ├── leasysParser.js       # Parser Leasys
│   │   ├── rentagoParser.js      # Parser Rentago
│   │   ├── drivefleeParser.js    # Parser DriveFlee
│   │   └── yoyomoveParser.js     # Parser YoyoMove
│   ├── scrapers/
│   │   └── carScraper.js         # Orchestratore scraping
│   └── utils/
│       ├── browser.js            # Gestione Playwright
│       ├── discordNotifier.js    # Invio messaggi Discord
│       ├── dataManager.js        # Gestione dati e storico
│       └── logger.js             # Sistema di logging
├── data/                         # Dati e storico
├── logs/                         # File di log
├── .env                          # Configurazione (da creare)
├── .env.example                  # Template configurazione
├── start-bot.bat                 # Script avvio Windows
├── package.json                  # Dipendenze e script
└── README.md                     # Questa documentazione
```

## 🔧 Configurazione Avanzata

### Formato Cron Schedule

Il formato cron supportato è: `minuto ora giorno mese giornosettimana`

Esempi:
- `0 8 * * *` - Ogni giorno alle 8:00
- `30 9 * * 1-5` - Giorni feriali alle 9:30
- `0 8,20 * * *` - Ogni giorno alle 8:00 e 20:00

### Range Prezzi e Durata

Modifica `MIN_PRICE`, `MAX_PRICE` e `MIN_DURATION_MONTHS` nel file `.env`:

```env
MIN_PRICE=100              # Minimo €100/mese
MAX_PRICE=350              # Massimo €350/mese
MIN_DURATION_MONTHS=48     # Minimo 48 mesi
```

### 🎯 Filtri Marche e Modelli

**Nuove opzioni di filtraggio avanzato:**

#### Marche Escluse
Escludi marche specifiche dalle offerte:
```env
EXCLUDED_BRANDS=DACIA,LADA,SKODA
# Lascia vuoto per includere tutte le marche
EXCLUDED_BRANDS=
```

#### Modelli Inclusi  
Include solo modelli che contengono determinate parole:
```env
INCLUDED_MODELS=C3,PANDA,CORSA,POLO,CLIO
# Lascia vuoto per includere tutti i modelli
INCLUDED_MODELS=
```

**Come funzionano:**
- **EXCLUDED_BRANDS**: Scarta offerte di marche specifiche (es: tutte le Dacia)
- **INCLUDED_MODELS**: Include solo modelli che contengono le parole specificate (es: "CITROËN C3 Plus" viene incluso se `C3` è nella lista)
- **Entrambi vuoti**: Nessun filtro aggiuntivo, usa solo prezzo/durata
- **Formato**: Lista separata da virgole, case-insensitive

**Esempi d'uso:**
```env
# Solo city car
EXCLUDED_BRANDS=FERRARI,LAMBORGHINI
INCLUDED_MODELS=PANDA,C1,C3,AYGO,UP

# Escludi marche economiche  
EXCLUDED_BRANDS=DACIA,LADA
INCLUDED_MODELS=

# Solo modelli specifici Volkswagen
EXCLUDED_BRANDS=
INCLUDED_MODELS=GOLF,POLO,TIGUAN
```

## 📊 Output Discord

Il bot invia messaggi Discord formattati con:

- 🔹 **Raggruppamento per marca** (FIAT, BMW, etc.)
- 💰 **Prezzo mensile** ordinato crescente
- 🌐 **Sito con prezzo migliore** per ogni modello
- 📈 **Offerte alternative** se disponibili
- 📅 **Timestamp** e statistiche sessione

Esempio messaggio:
```
🚗 Offerte Auto Noleggio Lungo Termine
2024-01-15 • 5 marche • 12 offerte

🔹 FIAT
Panda • €149/mese • Leasys
└ €159/mese • Ayvens
500 • €189/mese • Leasys

🔹 BMW  
Serie 1 • €299/mese • Alphabet
X1 • €349/mese • Leasys
```

## 🛠️ Manutenzione

### Aggiornamento Parser

Se un sito cambia struttura DOM, modifica il relativo parser in `src/parsers/`:

1. Aggiorna i selettori CSS nel metodo `parseOffers()`
2. Modifica `extractOfferData()` se necessario  
3. Testa con `npm run manual`

### Log e Debugging

I log sono salvati in `logs/` con rotazione giornaliera:

```bash
# Visualizza log di oggi
type logs\2024-01-15.log

# Modalità debug
set LOG_LEVEL=debug
npm start
```

### Pulizia Dati

Il bot pulisce automaticamente:
- **Log**: Mantenuti 7 giorni
- **Storico**: Mantenuto 30 giorni
- **Screenshot**: Solo in modalità debug

Pulizia manuale:
```bash
# Elimina tutti i log
rmdir /s logs

# Elimina storico dati  
rmdir /s data
```

## 🔍 Troubleshooting

### Bot non trova offerte

1. **Verifica connessione siti**:
```bash
ping noleggio.ayvens.com
```

2. **Controlla log**:
```bash
type logs\[data-oggi].log
```

3. **Testa singolo sito** modificando temporaneamente i parser

### Discord non riceve messaggi

1. **Verifica webhook URL**:
```bash
npm run test
```

2. **Controlla permessi canale** Discord

3. **Verifica rate limiting** Discord (max 30 msg/min)

### Errori di scraping

1. **Siti hanno cambiato struttura** → Aggiorna parser
2. **Anti-bot protection** → Aumenta delay in `.env`
3. **Timeout di rete** → Verifica connessione

## 🚀 Esempi di Utilizzo Avanzato

### Scenario 1: Scraping di un Sito in Modalità Visuale
```bash
# Prima imposta HEADLESS=false nel .env, poi:
node src/index.js --manual -s leaseplan
```

### Scenario 2: Scraping Selettivo per Debug
```bash
# Debug solo Ayvens e Leasys senza scheduler
node src/index.js --manual --sites ayvens,leasys
```

### Scenario 3: Scraping Completo Immediato
```bash
# Scraping di tutti i siti una volta
npm run manual
```

### Scenario 4: Verifica Setup Discord
```bash
# Prima verifica sempre Discord
npm run test-discord
```

## 📋 Riferimento Comandi Completo

| Comando | Descrizione | Esempio |
|---------|-------------|---------|
| `npm start` | Avvia scheduler automatico | `npm start` |
| `npm run manual` | Scraping manuale una volta | `npm run manual` |
| `npm run test-discord` | Test solo Discord | `npm run test-discord` |
| `npm run help` | Mostra help integrato | `npm run help` |
| `--sites <lista>` | Selezione siti specifici | `--sites leas,ayv` |
| `-s <lista>` | Alias breve per --sites | `-s leas,alpha` |
| `--manual` | Modalità manuale | `--manual --sites ayvens` |

## 📜 Licenza

MIT License - vedi file LICENSE per dettagli.

## 🤝 Contributi

1. Fork del progetto
2. Crea feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit delle modifiche (`git commit -m 'Add AmazingFeature'`)
4. Push al branch (`git push origin feature/AmazingFeature`)
5. Apri Pull Request

## 📞 Supporto

Per problemi o domande:

1. Usa `npm run help` per vedere tutti i comandi
2. Controlla la sezione **Troubleshooting**
3. Cerca negli **Issues** esistenti
4. Crea nuovo **Issue** con:
   - Versione Node.js (`node --version`)
   - Comando eseguito
   - Log di errore completi
   - Configurazione `.env` (senza webhook URL)

## 🔄 Changelog

### v1.1.0 (2024-01-15)
- ✨ **Parametri CLI semplificati** - Solo `--manual` per scraping immediato
- 🎯 **Selezione siti specifica** con `--sites` o `-s`
- 📋 **Help integrato** con `npm run help`
- 🔍 **Supporto alias** per nomi siti abbreviati
- 🌐 **Setup Playwright automatico** nel batch di avvio
- 🛠️ **Istruzioni Playwright** aggiunte alla documentazione

### v1.0.0 (2024-01-15)
- ✨ Prima release pubblica
- 🌐 Supporto per 6 siti principali (Ayvens, Alphabet, Leasys, Rentago, DriveFlee, YoyoMove)
- 📱 Integrazione Discord completa
- ⏰ Scheduling automatico
- 🛡️ Anti-detection avanzato
- 📊 Sistema dati e logging

---

**Sviluppato con ❤️**