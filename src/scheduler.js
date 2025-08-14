const cron = require('node-cron');
const config = require('./config');
const logger = require('./utils/logger');
const CarScraper = require('./scrapers/carScraper');
const discordNotifier = require('./utils/discordNotifier');
const dataManager = require('./utils/dataManager');

class Scheduler {
  constructor() {
    this.carScraper = new CarScraper();
    this.isRunning = false;
  }

  async init() {
    try {
      await dataManager.init();
      logger.info('Scheduler inizializzato');
    } catch (error) {
      logger.error('Errore durante l\'inizializzazione dello Scheduler', { error: error.message });
    }
  }

  start() {
    // Valida il formato cron
    if (!cron.validate(config.scheduling.cronSchedule)) {
      logger.error('Formato cron non valido:', config.scheduling.cronSchedule);
      return false;
    }

    logger.info(`Scheduler avviato con cron: ${config.scheduling.cronSchedule}`);
    
    // Programma il job
    cron.schedule(config.scheduling.cronSchedule, async () => {
      if (this.isRunning) {
        logger.warn('Scraping già in corso, saltando questa esecuzione');
        return;
      }

      await this.runScraping();
    }, {
      scheduled: true,
      timezone: "Europe/Rome"
    });

    // Invia messaggio di avvio
    discordNotifier.sendStartupMessage().catch(error => {
      logger.error('Errore nell\'invio del messaggio di avvio', { error: error.message });
    });

    return true;
  }

  async runScraping(sitesToScrape = null) {
    const startTime = Date.now();
    this.isRunning = true;

    try {
      logger.info('Inizio sessione di scraping...');

      // Esegui lo scraping
      const allOffers = await this.carScraper.scrapeAllSites(sitesToScrape);

      if (allOffers.length === 0) {
        logger.warn('Nessuna offerta trovata durante questa sessione');
        await discordNotifier.sendError('⚠️ Nessuna offerta trovata durante l\'ultima sessione di scraping.');
        return;
      }

      // Raggruppa le offerte per brand e modello
      const groupedOffers = this.carScraper.groupOffersByBrand(allOffers);
      const bestOffers = this.carScraper.getBestOffers(groupedOffers);

      // Salva i dati
      await dataManager.saveOffers(allOffers);

      // Invia la notifica Discord
      const discordSuccess = await discordNotifier.sendOffers(bestOffers);
      
      if (!discordSuccess) {
        logger.error('Fallito invio notifica Discord');
      }

      const endTime = Date.now();
      const duration = Math.round((endTime - startTime) / 1000);

      logger.info(`Sessione di scraping completata in ${duration}s`, {
        totalOffers: allOffers.length,
        brands: Object.keys(bestOffers).length,
        duration: `${duration}s`
      });

      // Cleanup periodico (una volta al giorno)
      const now = new Date();
      if (now.getHours() === 8 && now.getMinutes() < 10) {
        await dataManager.cleanup();
      }

    } catch (error) {
      logger.error('Errore durante la sessione di scraping', { 
        error: error.message,
        stack: error.stack 
      });
      
      await discordNotifier.sendError(`❌ Errore durante lo scraping: ${error.message}`);
    } finally {
      this.isRunning = false;
    }
  }

  // Metodo per eseguire lo scraping manualmente (per test)
  async runManual(sitesToScrape = null) {
    if (this.isRunning) {
      logger.warn('Scraping già in corso');
      return false;
    }

    logger.info('Avvio scraping manuale...');
    await this.runScraping(sitesToScrape);
    return true;
  }

  // Metodo per testare la connessione Discord
  async testDiscord() {
    try {
      logger.info('Test della notifica Discord...');
      
      const testOffers = {
        'FIAT': {
          'Panda': {
            bestOffer: {
              brand: 'FIAT',
              model: 'Panda',
              price: 150,
              duration: 48,
              site: 'Ayvens'
            },
            allOffers: [{
              brand: 'FIAT',
              model: 'Panda',
              price: 150,
              duration: 48,
              site: 'Ayvens'
            }],
            lowestPrice: 150,
            cheapestSite: 'Ayvens'
          }
        }
      };

      const success = await discordNotifier.sendOffers(testOffers);
      
      if (success) {
        logger.info('Test Discord completato con successo');
      } else {
        logger.error('Test Discord fallito');
      }
      
      return success;
    } catch (error) {
      logger.error('Errore durante il test Discord', { error: error.message });
      return false;
    }
  }

  stop() {
    // Note: node-cron non ha un metodo esplicito per fermare tutti i job
    // ma in genere il processo viene terminato
    logger.info('Scheduler arrestato');
  }
}

module.exports = Scheduler;