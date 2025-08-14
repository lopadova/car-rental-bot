#!/usr/bin/env node

const config = require('./config');
const logger = require('./utils/logger');
const Scheduler = require('./scheduler');
const CarScraper = require('./scrapers/carScraper');

// Gestisce la chiusura pulita dell'applicazione
process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
process.on('uncaughtException', handleUncaughtException);
process.on('unhandledRejection', handleUnhandledRejection);

async function main() {
  try {
    logger.info('🚗 Avvio Car Rental Bot...');
    
    // Verifica la configurazione
    if (!validateConfig()) {
      process.exit(1);
    }

    // Crea e inizializza lo scheduler
    const scheduler = new Scheduler();
    await scheduler.init();

    // Gestisci argomenti da linea di comando
    const args = process.argv.slice(2);
    const { sitesToScrape } = parseArguments(args);
    
    if (args.includes('--manual') || args.includes('-m')) {
      // Esecuzione manuale
      logger.info('📋 Modalità manuale: scraping immediato e terminazione...');
      
      if (sitesToScrape.length > 0) {
        logger.info(`🎯 Siti selezionati: ${sitesToScrape.join(', ')}`);
      }
      
      await scheduler.runManual(sitesToScrape.length > 0 ? sitesToScrape : null);
      process.exit(0);
    }
    
    if (args.includes('--test-discord') || args.includes('-t')) {
      // Test Discord
      logger.info('🔗 Modalità test: verifica connessione Discord...');
      const success = await scheduler.testDiscord();
      process.exit(success ? 0 : 1);
    }

    // Modalità normale: avvia lo scheduler
    const started = scheduler.start();
    
    if (!started) {
      logger.error('Impossibile avviare lo scheduler');
      process.exit(1);
    }

    logger.info('✅ Car Rental Bot avviato con successo!');
    logger.info(`📅 Prossima esecuzione programmata: ${config.scheduling.cronSchedule}`);
    logger.info(`💰 Range prezzi: €${config.scraping.minPrice}-${config.scraping.maxPrice}/mese`);
    logger.info(`⏱️ Durata minima: ${config.scraping.minDurationMonths} mesi`);
    
    // Mantieni il processo attivo
    keepAlive();

  } catch (error) {
    logger.error('Errore durante l\'avvio', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

function validateConfig() {
  let isValid = true;

  // Verifica URL webhook Discord
  if (!config.discord.webhookUrl || config.discord.webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
    logger.error('❌ URL webhook Discord non configurato. Modifica il file .env');
    isValid = false;
  }

  // Verifica range prezzi
  if (config.scraping.minPrice >= config.scraping.maxPrice) {
    logger.error('❌ Range prezzi non valido. MIN_PRICE deve essere minore di MAX_PRICE');
    isValid = false;
  }

  // Verifica durata minima
  if (config.scraping.minDurationMonths < 1) {
    logger.error('❌ Durata minima non valida. MIN_DURATION_MONTHS deve essere >= 1');
    isValid = false;
  }

  if (isValid) {
    logger.info('✅ Configurazione validata');
  }

  return isValid;
}

function keepAlive() {
  // Mantieni il processo attivo e mostra statistiche periodiche
  setInterval(async () => {
    const memUsage = process.memoryUsage();
    const uptime = process.uptime();
    
    logger.debug('Statistiche processo', {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      memory: `${Math.round(memUsage.rss / 1024 / 1024)}MB`,
      heap: `${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`
    });
  }, 60 * 60 * 1000); // Ogni ora
}

function handleExit(signal) {
  logger.info(`Ricevuto segnale ${signal}. Chiusura in corso...`);
  
  // Qui potresti aggiungere cleanup aggiuntivo se necessario
  
  logger.info('Car Rental Bot arrestato');
  process.exit(0);
}

function handleUncaughtException(error) {
  logger.error('Eccezione non gestita', { 
    error: error.message, 
    stack: error.stack 
  });
  
  // Non uscire immediatamente per permettere il logging
  setTimeout(() => process.exit(1), 1000);
}

function handleUnhandledRejection(reason, promise) {
  logger.error('Promise rejection non gestita', { 
    reason: reason,
    promise: promise 
  });
  
  // Non uscire per rejection non gestite, ma logga l'errore
}

function parseArguments(args) {
  let sitesToScrape = [];
  
  // Cerca parametro sites
  const sitesIndex = args.findIndex(arg => arg === '--sites' || arg === '-s');
  if (sitesIndex !== -1 && args[sitesIndex + 1]) {
    const sitesString = args[sitesIndex + 1];
    sitesToScrape = sitesString.split(',').map(s => s.trim()).filter(s => s);
    args.splice(sitesIndex, 2); // Rimuovi parametro e valore
  }
  
  return { sitesToScrape };
}

function showHelp() {
  const carScraper = new CarScraper();
  const availableSites = carScraper.getAvailableSites();
  
  console.log(`
🚗 Car Rental Bot - Sistema di monitoraggio offerte noleggio auto

UTILIZZO:
  node src/index.js [OPZIONI]

MODALITÀ PRINCIPALE:
  (nessuna opzione)                 Avvia il bot con scheduling automatico
  --manual, -m                      Esecuzione manuale (scraping immediato e termina)
  --test-discord                    Test solo connessione Discord

OPZIONI:
  --sites, -s <siti>                Specifica siti da scrappare (separati da virgola)
  --help, -h                        Mostra questo messaggio di aiuto

SITI DISPONIBILI:
  ${availableSites.join(', ')}

CONFIGURAZIONE (.env):
  DISCORD_WEBHOOK_URL               URL del webhook Discord
  MIN_PRICE, MAX_PRICE              Range di prezzi (€/mese)
  MIN_DURATION_MONTHS               Durata minima contratto
  CRON_SCHEDULE                     Orario di esecuzione (formato cron)
  HEADLESS                          true/false per modalità browser

ESEMPI:
  # Avvio normale con scheduler
  node src/index.js
  
  # Scraping immediato (tutti i siti)
  node src/index.js --manual
  
  # Scraping solo Ayvens e Leasys
  node src/index.js --manual --sites ayvens,leasys
  
  # Scraping solo Leasys (abbreviato)
  node src/index.js --manual -s leas
  
  # Test connessione Discord
  node src/index.js --test-discord
  
  # Alias NPM disponibili
  npm start                         # Avvio normale
  npm run manual                    # --manual
  npm run test-discord              # --test-discord
  npm run dev                       # Sviluppo con nodemon

SUPPORTO SITI PARZIALI:
  I nomi dei siti possono essere abbreviati (es: "ayv" per "ayvens")
  
LOGS E DEBUG:
  I log sono salvati in logs/ con rotazione giornaliera
  Imposta HEADLESS=false per vedere il browser in azione
  
SETUP INIZIALE:
  1. npm install                    # Installa dipendenze
  2. npx playwright install         # Installa browser Playwright
  3. Configura .env con webhook Discord
`);
}

// Mostra l'help se richiesto
if (process.argv.includes('--help') || process.argv.includes('-h') || process.argv.includes('help')) {
  showHelp();
  process.exit(0);
}

// Avvia l'applicazione
main();