const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class LeasysParser extends BaseParser {
  constructor() {
    super('Leasys');
  }

  async navigateToOffers(page) {
    try {
      await page.goto('https://www.leasys.com/it', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.handleCookieConsent(page);
      
      // Cerca il link per le offerte
      const offerSelectors = [
        'a[href*="offert"]',
        'a[href*="auto"]',
        'a[href*="veicoli"]',
        'text=Offerte',
        'text=Auto',
        'text=Veicoli'
      ];

      for (const selector of offerSelectors) {
        if (await this.safeClick(page, selector)) {
          await page.waitForTimeout(2000);
          break;
        }
      }

      logger.info('Navigazione completata su Leasys');
      return true;
    } catch (error) {
      logger.error('Errore durante la navigazione su Leasys', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori per le offerte Leasys
      const offerSelectors = [
        '.car-card',
        '.vehicle-card',
        '.offer-item',
        '[class*="car"]',
        '[class*="vehicle"]',
        '.product-item'
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) break;
      }

      if (offerElements.length === 0) {
        logger.warn('Nessuna offerta trovata su Leasys');
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
          logger.debug('Errore nell\'estrazione di un\'offerta Leasys', { error: error.message });
        }
      }

      logger.info(`Trovate ${offers.length} offerte valide su Leasys`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte Leasys', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Selettori specifici per Leasys
      const titleElement = await element.$('h3, h2, .title, .car-name') ||
                          await element.$('[class*="title"]') ||
                          await element.$('[class*="name"]');
      
      const priceElement = await element.$('.price, .monthly-price, [class*="price"]') ||
                          await element.$('text=/€/') ||
                          await element.$('[class*="rate"]');
      
      const durationElement = await element.$('.duration, .period, [class*="month"]') ||
                             await element.$('text=/mes/') ||
                             await element.$('text=/mesi/');

      const title = titleElement ? await titleElement.textContent() : '';
      const priceText = priceElement ? await priceElement.textContent() : '';
      const durationText = durationElement ? await durationElement.textContent() : '';

      // Parsing del titolo per brand e modello
      const titleClean = this.cleanText(title);
      const titleParts = titleClean.split(' ');
      const carBrand = titleParts[0] || '';
      const carModel = titleParts.slice(1).join(' ') || '';

      const price = this.extractPrice(priceText);
      const duration = this.extractDuration(durationText);

      if (!carBrand || !price) {
        return null;
      }

      return {
        brand: carBrand,
        model: carModel,
        price: price,
        duration: duration || 48, // Default a 48 mesi
        originalPrice: priceText,
        originalDuration: durationText
      };
    } catch (error) {
      logger.debug('Errore nell\'estrazione dati offerta Leasys', { error: error.message });
      return null;
    }
  }
}

module.exports = LeasysParser;