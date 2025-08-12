const { chromium } = require('playwright');
const config = require('../config');
const logger = require('./logger');

class BrowserManager {
  constructor() {
    this.browser = null;
    this.context = null;
  }

  async init() {
    try {
      logger.info('Inizializzazione browser...');
      
      this.browser = await chromium.launch({
        headless: config.browser.headless,
        args: [
          '--no-sandbox',
          '--disable-blink-features=AutomationControlled',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--window-size=1920,1080'
        ]
      });

      this.context = await this.browser.newContext({
        userAgent: config.browser.userAgent,
        viewport: { width: 1920, height: 1080 },
        locale: 'it-IT',
        timezoneId: 'Europe/Rome',
        // Simula un browser reale
        extraHTTPHeaders: {
          'Accept-Language': 'it-IT,it;q=0.9,en;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });

      // Nasconde che è un browser automatizzato
      await this.context.addInitScript(() => {
        // Rimuove webdriver flag
        Object.defineProperty(navigator, 'webdriver', {
          get: () => undefined,
        });

        // Override del chrome object
        window.chrome = {
          runtime: {},
        };

        // Override delle funzioni di detection
        Object.defineProperty(navigator, 'plugins', {
          get: () => [1, 2, 3, 4, 5],
        });

        Object.defineProperty(navigator, 'languages', {
          get: () => ['it-IT', 'it', 'en'],
        });
      });

      logger.info('Browser inizializzato con successo');
    } catch (error) {
      logger.error('Errore durante l\'inizializzazione del browser', { error: error.message });
      throw error;
    }
  }

  async newPage() {
    if (!this.context) {
      await this.init();
    }

    const page = await this.context.newPage();
    
    // Blocca risorse non necessarie per velocizzare
    await page.route('**/*', (route) => {
      const resourceType = route.request().resourceType();
      if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    return page;
  }

  async randomDelay() {
    const delay = Math.floor(Math.random() * (config.browser.delayMax - config.browser.delayMin + 1)) + config.browser.delayMin;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  async close() {
    try {
      if (this.context) {
        await this.context.close();
      }
      if (this.browser) {
        await this.browser.close();
      }
      logger.info('Browser chiuso');
    } catch (error) {
      logger.error('Errore durante la chiusura del browser', { error: error.message });
    }
  }
}

module.exports = new BrowserManager();