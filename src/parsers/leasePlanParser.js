const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class LeasePlanParser extends BaseParser {
  constructor() {
    super('LeasePlan');
  }

  async navigateToOffers(page) {
    try {
      await page.goto('https://www.leaseplan.com/it-it/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.handleCookieConsent(page);
      
      // Cerca il link per le offerte/preventivi
      const offerSelectors = [
        'a[href*="offert"]',
        'a[href*="preventiv"]',
        'a[href*="noleggio"]',
        'text=Offerte',
        'text=Preventivi',
        'text=Noleggio'
      ];

      for (const selector of offerSelectors) {
        if (await this.safeClick(page, selector)) {
          await page.waitForTimeout(2000);
          break;
        }
      }

      logger.info('Navigazione completata su LeasePlan');
      return true;
    } catch (error) {
      logger.error('Errore durante la navigazione su LeasePlan', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori per le offerte (da adattare al DOM reale)
      const offerSelectors = [
        '.offer-card',
        '.car-offer',
        '.lease-offer',
        '[class*="offer"]',
        '[data-testid*="offer"]'
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) break;
      }

      if (offerElements.length === 0) {
        logger.warn('Nessuna offerta trovata su LeasePlan');
        return offers;
      }

      for (const element of offerElements.slice(0, 20)) { // Limita a 20 offerte
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
          logger.debug('Errore nell\'estrazione di un\'offerta LeasePlan', { error: error.message });
        }
      }

      logger.info(`Trovate ${offers.length} offerte valide su LeasePlan`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte LeasePlan', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Estrai i dati dell'offerta (selettori da adattare)
      const brandElement = await element.$('h3, .brand, [class*="brand"]') || 
                          await element.$('h2') ||
                          await element.$('.title');
      
      const priceElement = await element.$('.price, [class*="price"], [data-testid*="price"]') ||
                          await element.$('text=/€/');
      
      const durationElement = await element.$('.duration, [class*="duration"], [class*="month"]') ||
                             await element.$('text=/mes/');

      const brand = brandElement ? await brandElement.textContent() : '';
      const priceText = priceElement ? await priceElement.textContent() : '';
      const durationText = durationElement ? await durationElement.textContent() : '';

      // Parsing del brand e modello
      const brandParts = this.cleanText(brand).split(' ');
      const carBrand = brandParts[0] || '';
      const carModel = brandParts.slice(1).join(' ') || '';

      const price = this.extractPrice(priceText);
      const duration = this.extractDuration(durationText);

      if (!carBrand || !price || !duration) {
        return null;
      }

      return {
        brand: carBrand,
        model: carModel,
        price: price,
        duration: duration,
        originalPrice: priceText,
        originalDuration: durationText
      };
    } catch (error) {
      logger.debug('Errore nell\'estrazione dati offerta LeasePlan', { error: error.message });
      return null;
    }
  }
}

module.exports = LeasePlanParser;