const BaseParser = require('./baseParser');
const logger = require('../utils/logger');
const config = require('../config');

class AyvensParser extends BaseParser {
  constructor() {
    super('Ayvens');
  }

  async navigateToOffers(page) {
    try {
      await page.goto('https://noleggio.ayvens.com/it-it/noleggio-lungo-termine/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      await this.handleCookieConsent(page);
      
      // Attendiamo che la pagina si carichi completamente
      await page.waitForTimeout(3000);
      
      // Prova ad applicare i filtri se possibile
      await this.applyFilters(page);
      
      logger.info('Navigazione completata su Ayvens');
      return true;
    } catch (error) {
      logger.error('Errore durante la navigazione su Ayvens', { error: error.message });
      return false;
    }
  }

  async applyFilters(page) {
    try {
      logger.info('Tentativo di applicazione filtri Ayvens...');
      
      // Cerca filtri prezzo - selettori comuni per slider/input prezzo
      const priceSelectors = [
        'input[name*="price"]',
        'input[name*="prezzo"]',
        'input[placeholder*="prezzo"]',
        'input[placeholder*="price"]',
        '[data-testid*="price"]',
        '.price-filter input',
        '.filter-price input'
      ];

      let priceFiltered = false;
      for (const selector of priceSelectors) {
        const priceInputs = await page.$$(selector);
        if (priceInputs.length >= 2) {
          try {
            // Input prezzo minimo
            await priceInputs[0].fill(config.scraping.minPrice.toString());
            await page.waitForTimeout(500);
            
            // Input prezzo massimo  
            await priceInputs[1].fill(config.scraping.maxPrice.toString());
            await page.waitForTimeout(500);
            
            logger.info(`Filtro prezzo applicato: €${config.scraping.minPrice}-${config.scraping.maxPrice}`);
            priceFiltered = true;
            break;
          } catch (error) {
            logger.debug(`Errore con selettore prezzo ${selector}`, { error: error.message });
          }
        }
      }

      // Cerca filtri durata contratto
      const durationSelectors = [
        'select[name*="duration"]',
        'select[name*="durata"]',
        'input[name*="duration"]',
        'input[name*="mesi"]',
        'input[name*="months"]',
        '[data-testid*="duration"]',
        '.duration-filter select',
        '.filter-duration select'
      ];

      let durationFiltered = false;
      for (const selector of durationSelectors) {
        const durationElement = await page.$(selector);
        if (durationElement) {
          try {
            const tagName = await durationElement.evaluate(el => el.tagName.toLowerCase());
            
            if (tagName === 'select') {
              // Prova a selezionare la durata minima
              await durationElement.selectOption({ value: config.scraping.minDurationMonths.toString() });
            } else if (tagName === 'input') {
              await durationElement.fill(config.scraping.minDurationMonths.toString());
            }
            
            await page.waitForTimeout(500);
            logger.info(`Filtro durata applicato: ${config.scraping.minDurationMonths} mesi`);
            durationFiltered = true;
            break;
          } catch (error) {
            logger.debug(`Errore con selettore durata ${selector}`, { error: error.message });
          }
        }
      }

      // Cerca e clicca pulsante "Applica filtri" o "Cerca"
      const applySelectors = [
        'button[type="submit"]',
        'button:has-text("Applica")',
        'button:has-text("Cerca")',
        'button:has-text("Filtra")',
        '[data-testid*="apply"]',
        '[data-testid*="search"]',
        '.btn-search',
        '.btn-apply'
      ];

      for (const selector of applySelectors) {
        if (await this.safeClick(page, selector)) {
          await page.waitForTimeout(2000);
          logger.info('Filtri applicati con successo');
          break;
        }
      }

      if (!priceFiltered && !durationFiltered) {
        logger.info('Nessun filtro applicato - useremo il parsing per filtrare i risultati');
      }

    } catch (error) {
      logger.warn('Errore durante l\'applicazione dei filtri Ayvens', { error: error.message });
      logger.info('Procedo senza filtri - useremo il parsing per filtrare');
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori specifici per Ayvens - da adattare dopo aver visto la pagina
      const offerSelectors = [
        '.vehicle-card',
        '.car-card', 
        '.offer-card',
        '.product-card',
        '.vehicle-item',
        '[class*="vehicle"]',
        '[class*="car"]',
        '[class*="offer"]',
        '[class*="product"]',
        'article',
        '.row .col-md-4', // Layout griglia comune
        '.row .col-lg-4',
        '.list-group-item'
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) {
          logger.info(`Trovati ${offerElements.length} elementi con selettore: ${selector}`);
          break;
        }
      }

      if (offerElements.length === 0) {
        logger.warn('Nessuna offerta trovata su Ayvens - provo selettori generici');
        
        // Selettori di fallback più generici
        const fallbackSelectors = ['div[class*="card"]', 'div[class*="item"]', 'li'];
        for (const selector of fallbackSelectors) {
          offerElements = await page.$$(selector);
          if (offerElements.length > 3) { // Almeno alcune card
            logger.info(`Usando selettore di fallback: ${selector} (${offerElements.length} elementi)`);
            break;
          }
        }
      }

      for (const element of offerElements.slice(0, 30)) { // Aumentato a 30 per più risultati
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
          logger.debug('Errore nell\'estrazione di un\'offerta Ayvens', { error: error.message });
        }
      }

      logger.info(`Trovate ${offers.length} offerte valide su Ayvens`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte Ayvens', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Selettori specifici per Ayvens - più completi e flessibili
      const titleSelectors = [
        'h1, h2, h3, h4, h5, h6',
        '.title, .vehicle-title, .car-title, .product-title',
        '[class*="title"]', 
        '[class*="name"]',
        '.vehicle-name, .car-name, .product-name',
        'strong', 'b'
      ];

      const priceSelectors = [
        '.price, .monthly-price, .prezzo',
        '[class*="price"]', '[class*="prezzo"]', '[class*="cost"]',
        'span:has-text("€")', 'div:has-text("€")',
        '[data-testid*="price"]'
      ];

      const durationSelectors = [
        '.duration, .durata, .contract-length',
        '[class*="duration"]', '[class*="durata"]', '[class*="month"]',
        'span:has-text("mesi")', 'span:has-text("mes")', 'span:has-text("anni")',
        'div:has-text("mesi")', 'div:has-text("mes")'
      ];

      // Estrai titolo/nome veicolo
      let title = '';
      for (const selector of titleSelectors) {
        const titleElement = await element.$(selector);
        if (titleElement) {
          title = await titleElement.textContent();
          title = this.cleanText(title);
          if (title && title.length > 3) break; // Titolo valido trovato
        }
      }

      // Estrai prezzo
      let priceText = '';
      for (const selector of priceSelectors) {
        const priceElement = await element.$(selector);
        if (priceElement) {
          priceText = await priceElement.textContent();
          priceText = this.cleanText(priceText);
          if (priceText.includes('€') || /\d+/.test(priceText)) break; // Prezzo valido trovato
        }
      }

      // Estrai durata
      let durationText = '';
      for (const selector of durationSelectors) {
        const durationElement = await element.$(selector);
        if (durationElement) {
          durationText = await durationElement.textContent();
          durationText = this.cleanText(durationText);
          if (durationText.includes('mes') || durationText.includes('ann') || /\d+/.test(durationText)) break;
        }
      }

      // Se non troviamo info specifiche, prova tutto il testo dell'elemento
      if (!title && !priceText) {
        const fullText = await element.textContent();
        const cleanFullText = this.cleanText(fullText);
        
        // Cerca pattern prezzo nel testo
        const priceMatch = cleanFullText.match(/€\s*(\d+[.,]?\d*)/);
        if (priceMatch) priceText = priceMatch[0];
        
        // Cerca pattern titolo auto (lettere seguite da numeri/lettere)
        const titleMatch = cleanFullText.match(/^([A-Za-z]+(?:\s+[A-Za-z0-9]+){0,3})/);
        if (titleMatch) title = titleMatch[1];
      }

      // Parsing del titolo per brand e modello
      const titleParts = title.split(' ').filter(part => part.length > 0);
      const carBrand = titleParts[0] || '';
      const carModel = titleParts.slice(1).join(' ') || '';

      const price = this.extractPrice(priceText);
      const duration = this.extractDuration(durationText);

      // Debug logging per capire cosa stiamo estraendo
      if (title || priceText) {
        logger.debug('Dati estratti Ayvens', {
          title,
          priceText,
          durationText,
          brand: carBrand,
          model: carModel,
          price,
          duration
        });
      }

      // Valida che abbiamo almeno brand e prezzo
      if (!carBrand || !price || price <= 0) {
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
      logger.debug('Errore nell\'estrazione dati offerta Ayvens', { error: error.message });
      return null;
    }
  }
}

module.exports = AyvensParser;