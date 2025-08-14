const browserManager = require('../utils/browser');
const logger = require('../utils/logger');

// Importa tutti i parser
const AyvensParser = require('../parsers/ayvensParser');
const AlphabetParser = require('../parsers/alphabetParser');
const LeasysParser = require('../parsers/leasysParser');
const RentagoParser = require('../parsers/rentagoParser');

class CarScraper {
  constructor() {
    this.parsers = {
      ayvens: new AyvensParser(),
      alphabet: new AlphabetParser(),
      leasys: new LeasysParser(),
      rentago: new RentagoParser()
    };
  }

  async scrapeAllSites(sitesToScrape = null) {
    const allOffers = [];
    
    // Determina quali siti scrappare
    const targetSites = sitesToScrape ? 
      this.filterSitesByNames(sitesToScrape) : 
      Object.entries(this.parsers);
    
    if (targetSites.length === 0) {
      logger.warn('Nessun sito valido specificato per lo scraping');
      return allOffers;
    }

    logger.info(`Scraping programmato per: ${targetSites.map(([name]) => name).join(', ')}`);
    
    try {
      await browserManager.init();
      
      for (const [siteName, parser] of targetSites) {
        try {
          logger.info(`Inizio scraping di ${siteName}...`);
          
          const offers = await this.scrapeSite(parser);
          allOffers.push(...offers);
          
          logger.info(`Completato scraping di ${siteName}: ${offers.length} offerte trovate`);
          
          // Pausa tra i siti
          await browserManager.randomDelay();
          
        } catch (error) {
          logger.error(`Errore durante lo scraping di ${siteName}`, { error: error.message });
        }
      }
      
    } catch (error) {
      logger.error('Errore durante l\'inizializzazione del browser', { error: error.message });
    } finally {
      await browserManager.close();
    }

    logger.info(`Scraping completato: ${allOffers.length} offerte totali trovate`);
    return allOffers;
  }

  filterSitesByNames(siteNames) {
    const availableSites = Object.keys(this.parsers);
    const filteredSites = [];
    
    for (const siteName of siteNames) {
      const normalizedName = siteName.toLowerCase().trim();
      
      // Cerca corrispondenza esatta o parziale
      const matchedSite = availableSites.find(site => 
        site.toLowerCase() === normalizedName || 
        site.toLowerCase().includes(normalizedName) ||
        normalizedName.includes(site.toLowerCase())
      );
      
      if (matchedSite) {
        filteredSites.push([matchedSite, this.parsers[matchedSite]]);
        logger.info(`Sito selezionato: ${matchedSite}`);
      } else {
        logger.warn(`Sito non trovato: ${siteName}. Siti disponibili: ${availableSites.join(', ')}`);
      }
    }
    
    return filteredSites;
  }

  getAvailableSites() {
    return Object.keys(this.parsers);
  }

  async scrapeSite(parser) {
    const offers = [];
    let page = null;
    
    try {
      page = await browserManager.newPage();
      
      // Naviga alla sezione offerte
      const navigationSuccess = await parser.navigateToOffers(page);
      if (!navigationSuccess) {
        logger.warn(`Navigazione fallita per ${parser.siteName}`);
        return offers;
      }

      // Pausa dopo la navigazione
      await browserManager.randomDelay();

      // Estrai le offerte
      const siteOffers = await parser.parseOffers(page);
      offers.push(...siteOffers);

      // Screenshot per debug (opzionale)
      if (process.env.NODE_ENV === 'development') {
        await this.takeDebugScreenshot(page, parser.siteName);
      }

    } catch (error) {
      logger.error(`Errore durante lo scraping di ${parser.siteName}`, { error: error.message });
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (error) {
          logger.debug(`Errore durante la chiusura della pagina di ${parser.siteName}`);
        }
      }
    }

    return offers;
  }

  async takeDebugScreenshot(page, siteName) {
    try {
      const fs = require('fs-extra');
      const path = require('path');
      
      const screenshotDir = path.join(__dirname, '../../data/screenshots');
      await fs.ensureDir(screenshotDir);
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${siteName}_${timestamp}.png`;
      
      await page.screenshot({ 
        path: path.join(screenshotDir, filename),
        fullPage: true 
      });
      
      logger.debug(`Screenshot salvato: ${filename}`);
    } catch (error) {
      logger.debug('Errore durante il salvataggio dello screenshot', { error: error.message });
    }
  }

  // Raggruppa le offerte per brand e modello
  groupOffersByBrand(offers) {
    const grouped = {};
    
    for (const offer of offers) {
      const brand = offer.brand.toUpperCase();
      const model = offer.model;
      const key = `${brand}_${model}`;
      
      if (!grouped[brand]) {
        grouped[brand] = {};
      }
      
      if (!grouped[brand][model]) {
        grouped[brand][model] = [];
      }
      
      grouped[brand][model].push(offer);
    }

    return grouped;
  }

  // Trova l'offerta migliore per ogni modello
  getBestOffers(groupedOffers) {
    const bestOffers = {};
    
    for (const [brand, models] of Object.entries(groupedOffers)) {
      bestOffers[brand] = {};
      
      for (const [model, offers] of Object.entries(models)) {
        // Ordina per prezzo crescente
        offers.sort((a, b) => a.price - b.price);
        
        bestOffers[brand][model] = {
          bestOffer: offers[0], // L'offerta più economica
          allOffers: offers,
          lowestPrice: offers[0].price,
          cheapestSite: offers[0].site
        };
      }
    }
    
    return bestOffers;
  }
}

module.exports = CarScraper;