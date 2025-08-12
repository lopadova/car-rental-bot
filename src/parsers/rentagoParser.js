const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class RentagoParser extends BaseParser {
  constructor() {
    super('Rentago');
  }

  async navigateToOffers(page) {
    try {
      await page.goto('https://www.rentago.it/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.handleCookieConsent(page);
      
      // Cerca il link per le offerte
      const offerSelectors = [
        'a[href*="offert"]',
        'a[href*="auto"]',
        'a[href*="noleggio"]',
        'text=Offerte',
        'text=Auto',
        'text=Noleggio'
      ];

      for (const selector of offerSelectors) {
        if (await this.safeClick(page, selector)) {
          await page.waitForTimeout(2000);
          break;
        }
      }

      logger.info('Navigazione completata su Rentago');
      return true;
    } catch (error) {
      logger.error('Errore durante la navigazione su Rentago', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori per le offerte Rentago
      const offerSelectors = [
        '.auto-card',
        '.car-item',
        '.offer-card',
        '[class*="auto"]',
        '[class*="car"]',
        '.rental-item'
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) break;
      }

      if (offerElements.length === 0) {
        logger.warn('Nessuna offerta trovata su Rentago');
        return offers;
      }

      for (const element of offerElements.slice(0, 20)) {
        try {
          const offer = await this.extractOfferData(page, element);
          if (offer && this.isValidOffer(offer)) {
            offers.push({
              ...offer,
              site: this.siteName,
              url: page.url()
            });
          }
        } catch (error) {
          logger.debug('Errore nell\'estrazione di un\'offerta Rentago', { error: error.message });
        }
      }

      logger.info(`Trovate ${offers.length} offerte valide su Rentago`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte Rentago', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Selettori specifici per Rentago
      const nameElement = await element.$('h3, h2, .auto-name, .car-title') ||
                         await element.$('[class*="title"]') ||
                         await element.$('[class*="name"]');
      
      const priceElement = await element.$('.prezzo, .price, [class*="price"]') ||
                          await element.$('text=/€/') ||
                          await element.$('[class*="costo"]');
      
      const durationElement = await element.$('.durata, .duration, [class*="month"]') ||
                             await element.$('text=/mes/') ||
                             await element.$('text=/anni/');

      const name = nameElement ? await nameElement.textContent() : '';
      const priceText = priceElement ? await priceElement.textContent() : '';
      const durationText = durationElement ? await durationElement.textContent() : '';

      // Parsing del nome per brand e modello
      const nameClean = this.cleanText(name);
      const nameParts = nameClean.split(' ');
      const carBrand = nameParts[0] || '';
      const carModel = nameParts.slice(1).join(' ') || '';

      const price = this.extractPrice(priceText);
      const duration = this.extractDuration(durationText);

      // Se la durata è in anni, convertila in mesi
      let finalDuration = duration;
      if (durationText && durationText.toLowerCase().includes('ann')) {
        finalDuration = duration * 12;
      }

      if (!carBrand || !price) {
        return null;
      }

      return {
        brand: carBrand,
        model: carModel,
        price: price,
        duration: finalDuration || 48, // Default a 48 mesi
        originalPrice: priceText,
        originalDuration: durationText
      };
    } catch (error) {
      logger.debug('Errore nell\'estrazione dati offerta Rentago', { error: error.message });
      return null;
    }
  }
}

module.exports = RentagoParser;