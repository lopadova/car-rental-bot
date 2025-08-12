const config = require('../config');
const logger = require('../utils/logger');

class BaseParser {
  constructor(siteName) {
    this.siteName = siteName;
  }

  // Metodi che devono essere implementati dalle classi figlie
  async parseOffers(page) {
    throw new Error(`parseOffers must be implemented by ${this.siteName} parser`);
  }

  async navigateToOffers(page) {
    throw new Error(`navigateToOffers must be implemented by ${this.siteName} parser`);
  }

  // Metodi comuni a tutti i parser
  isValidOffer(offer) {
    // Il prezzo e la durata dovrebbero già essere numeri dal parser
    const price = typeof offer.price === 'number' ? offer.price : this.extractPrice(offer.price);
    const duration = typeof offer.duration === 'number' ? offer.duration : this.extractDuration(offer.duration);

    if (!price || !duration) {
      return false;
    }

    // Controlli base prezzo e durata
    const priceValid = price >= config.scraping.minPrice && price <= config.scraping.maxPrice;
    const durationValid = duration >= config.scraping.minDurationMonths;
    
    // Logica di validazione con priorità:
    // 1. Se INCLUDED_MODELS è riempito, vince quello (passa solo se il modello inizia con uno dei valori)
    // 2. Se INCLUDED_MODELS è vuoto, si attivano i filtri EXCLUDED (brand e modelli)
    let modelValid = true;
    let brandValid = true;
    
    if (config.scraping.includedModels.length > 0) {
      // PRIORITÀ 1: INCLUDED_MODELS vince su tutto
      modelValid = config.scraping.includedModels.some(includedModel => 
        offer.model.toUpperCase().startsWith(includedModel)
      );
      // Quando INCLUDED_MODELS è attivo, ignoriamo EXCLUDED_BRANDS e EXCLUDED_MODELS
    } else {
      // PRIORITÀ 2: EXCLUDED filters (solo se INCLUDED_MODELS è vuoto)
      // Controllo brand esclusi
      brandValid = config.scraping.excludedBrands.length === 0 || 
                   !config.scraping.excludedBrands.includes(offer.brand.toUpperCase());
      
      // Controllo modelli esclusi
      const modelExcludedValid = config.scraping.excludedModels.length === 0 || 
                                !config.scraping.excludedModels.some(excludedModel => 
                                  offer.model.toUpperCase().startsWith(excludedModel)
                                );
      
      modelValid = modelExcludedValid;
    }

    const isValid = priceValid && durationValid && brandValid && modelValid;

    // Debug dettagliato per capire perché un'offerta viene scartata
    if (!isValid) {
      const logger = require('./logger');
      logger.debug('🔍 Dettaglio validazione offerta:', {
        brand: offer.brand,
        model: offer.model,
        price: price,
        duration: duration,
        minPrice: config.scraping.minPrice,
        maxPrice: config.scraping.maxPrice,
        minDuration: config.scraping.minDurationMonths,
        excludedBrands: config.scraping.excludedBrands,
        excludedModels: config.scraping.excludedModels,
        includedModels: config.scraping.includedModels,
        priceValid: priceValid,
        durationValid: durationValid,
        brandValid: brandValid,
        modelValid: modelValid
      });
    }

    return isValid;
  }

  extractPrice(priceString) {
    if (!priceString || typeof priceString !== 'string') return null;
    
    // Rimuove caratteri non numerici eccetto virgole e punti
    const cleanPrice = priceString.replace(/[^\d.,]/g, '');
    
    // Gestisce formato italiano (123,45) e internazionale (123.45)
    const price = parseFloat(cleanPrice.replace(',', '.'));
    
    return isNaN(price) ? null : Math.round(price);
  }

  extractDuration(durationString) {
    if (!durationString || typeof durationString !== 'string') return null;

    // Cerca numeri seguiti da "mes", "month", "mesi"
    const matches = durationString.match(/(\d+)\s*(?:mes|month|mesi)/i);
    
    if (matches) {
      return parseInt(matches[1]);
    }

    // Cerca solo numeri se non trova la parola "mesi"
    const numberMatch = durationString.match(/\d+/);
    return numberMatch ? parseInt(numberMatch[0]) : null;
  }

  normalizeCarModel(brand, model) {
    const normalizedBrand = brand.trim().toUpperCase();
    const normalizedModel = model.trim();
    
    return {
      brand: normalizedBrand,
      model: normalizedModel,
      fullName: `${normalizedBrand} ${normalizedModel}`
    };
  }

  async waitForElement(page, selector, timeout = 10000) {
    try {
      await page.waitForSelector(selector, { timeout });
      return true;
    } catch (error) {
      logger.warn(`Elemento non trovato: ${selector} su ${this.siteName}`);
      return false;
    }
  }

  async safeClick(page, selector, timeout = 5000) {
    try {
      await page.waitForSelector(selector, { timeout });
      await page.click(selector);
      return true;
    } catch (error) {
      logger.warn(`Impossibile cliccare su: ${selector} su ${this.siteName}`);
      return false;
    }
  }

  async safeText(page, selector, defaultValue = '') {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.textContent();
      }
    } catch (error) {
      logger.debug(`Errore nell'estrazione del testo da: ${selector}`);
    }
    return defaultValue;
  }

  async safeAttribute(page, selector, attribute, defaultValue = '') {
    try {
      const element = await page.$(selector);
      if (element) {
        return await element.getAttribute(attribute);
      }
    } catch (error) {
      logger.debug(`Errore nell'estrazione dell'attributo ${attribute} da: ${selector}`);
    }
    return defaultValue;
  }

  cleanText(text) {
    if (!text) return '';
    return text.trim().replace(/\s+/g, ' ');
  }

  async handleCookieConsent(page) {
    // Selettori comuni per il consenso cookie + specifici per Ayvens
    const cookieSelectors = [
      // Selettori generici
      '[id*="cookie"] button',
      '[class*="cookie"] button', 
      'button[id*="accept"]',
      'button[class*="accept"]',
      '[data-testid*="cookie"] button',
      '.cookie-banner button',
      '#cookie-consent button',
      // Selettori specifici per popup Angular/modali
      '.modal button',
      '[class*="modal"] button',
      'button:has-text("Accetta")',
      'button:has-text("Accept")',
      'button:has-text("OK")', 
      'button:has-text("Chiudi")',
      'button:has-text("Close")',
      // Selettori overlay/backdrop
      '.overlay button',
      '.backdrop button'
    ];

    // Prova a chiudere popup per 10 secondi
    const timeout = 10000;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            // Verifica se il pulsante è visibile
            const isVisible = await button.isVisible();
            if (isVisible) {
              await button.click();
              logger.info(`✅ Popup/Cookie chiuso su ${this.siteName} con selettore: ${selector}`);
              await page.waitForTimeout(1000);
              return true;
            }
          }
        } catch (error) {
          // Continua con il prossimo selettore
        }
      }
      await page.waitForTimeout(500);
    }

    logger.info(`⚠️ Nessun popup cookie trovato su ${this.siteName} (potrebbe essere normale)`);
    return false;
  }
}

module.exports = BaseParser;