const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class AlphabetParser extends BaseParser {
  constructor() {
    super('Alphabet');
  }

  async navigateToOffers(page) {
    try {
      await page.goto('https://www.alphabet.com/it-it', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.handleCookieConsent(page);
      
      // Cerca il link per le offerte
      const offerSelectors = [
        'a[href*="offert"]',
        'a[href*="veicoli"]',
        'a[href*="fleet"]',
        'text=Offerte',
        'text=Veicoli',
        'text=Fleet'
      ];

      for (const selector of offerSelectors) {
        if (await this.safeClick(page, selector)) {
          await page.waitForTimeout(2000);
          break;
        }
      }

      logger.info('Navigazione completata su Alphabet');
      return true;
    } catch (error) {
      logger.error('Errore durante la navigazione su Alphabet', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori per le offerte Alphabet
      const offerSelectors = [
        '.car-tile',
        '.vehicle-tile',
        '.offer-card',
        '[class*="vehicle"]',
        '[class*="car"]',
        '.fleet-card'
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) break;
      }

      if (offerElements.length === 0) {
        logger.warn('Nessuna offerta trovata su Alphabet');
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
          logger.debug('Errore nell\'estrazione di un\'offerta Alphabet', { error: error.message });
        }
      }

      logger.info(`Trovate ${offers.length} offerte valide su Alphabet`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte Alphabet', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Selettori specifici per Alphabet
      const brandElement = await element.$('.car-brand, .vehicle-brand, h3, h2') ||
                          await element.$('[class*="brand"]');
      
      const modelElement = await element.$('.car-model, .vehicle-model') ||
                          await element.$('[class*="model"]');
      
      const priceElement = await element.$('.price, .monthly-rate, [class*="price"]') ||
                          await element.$('text=/€/') ||
                          await element.$('[data-testid*="price"]');
      
      const durationElement = await element.$('.duration, .term, [class*="month"]') ||
                             await element.$('text=/mes/');

      const brand = brandElement ? await brandElement.textContent() : '';
      const model = modelElement ? await modelElement.textContent() : '';
      const priceText = priceElement ? await priceElement.textContent() : '';
      const durationText = durationElement ? await durationElement.textContent() : '';

      // Se non c'è separazione brand/model, prova a estrarre dal titolo completo
      let carBrand = this.cleanText(brand);
      let carModel = this.cleanText(model);

      if (!carBrand && !carModel) {
        const titleElement = await element.$('h3, h2, .title, [class*="title"]');
        if (titleElement) {
          const fullTitle = await titleElement.textContent();
          const titleParts = this.cleanText(fullTitle).split(' ');
          carBrand = titleParts[0] || '';
          carModel = titleParts.slice(1).join(' ') || '';
        }
      }

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
      logger.debug('Errore nell\'estrazione dati offerta Alphabet', { error: error.message });
      return null;
    }
  }
}

module.exports = AlphabetParser;