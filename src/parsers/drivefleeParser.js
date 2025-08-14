const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class DriveFleeParser extends BaseParser {
  constructor() {
    super('DriveFlee');
  }

  async navigateToOffers(page) {
    try {
      logger.info('🌐 Navigazione verso DriveFlee...');
      
      await page.goto('https://driveflee.com/noleggio-a-lungo-termine/', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logger.info('📄 Pagina DriveFlee caricata, gestione cookie consent...');
      await this.handleCookieConsent(page);
      
      // Attesa per assicurarsi che la pagina sia completamente caricata
      await page.waitForTimeout(3000);
      
      logger.info('✅ Navigazione completata su DriveFlee - pronto per parsing offerte');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su DriveFlee', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte DriveFlee (pagina singola)...');
      
      // Attesa per il caricamento completo della pagina
      await page.waitForTimeout(2000);
      
      const offers = [];
      
      // Selettori per le card delle offerte DriveFlee basati sull'HTML fornito
      const cardSelectors = [
        'a[href*="/noleggio-a-lungo-termine/"]',
        '.flex.flex-col.tablet\\:flex-row',
        '[class*="rounded-3xl"][class*="bg-white"]',
        'a[class*="flex"][class*="h-full"]',
        // Selettori più generici come fallback
        'a:has(.font-semibold)',
        'a:has(h3)',
        '.offer-card'
      ];

      let cardElements = [];
      for (const selector of cardSelectors) {
        try {
          cardElements = await page.$$(selector);
          if (cardElements.length > 0) {
            logger.debug(`🔍 Trovate ${cardElements.length} card con selettore: ${selector}`);
            break;
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore ${selector}:`, error.message);
        }
      }

      if (cardElements.length === 0) {
        logger.warn('❌ Nessuna card trovata nella pagina');
        return offers;
      }

      logger.info(`📋 Trovate ${cardElements.length} card da processare...`);

      // Estrai dati da ogni card
      for (let i = 0; i < cardElements.length; i++) {
        try {
          const offer = await this.extractOfferFromCard(page, cardElements[i], i + 1);
          if (offer) {
            offers.push(offer);
            logger.debug(`✅ Card ${i + 1}/${cardElements.length}: estratta offerta`, { 
              brand: offer.brand, 
              model: offer.model, 
              price: offer.price 
            });
          } else {
            logger.debug(`⚠️ Card ${i + 1}/${cardElements.length}: estrazione fallita`);
          }
        } catch (error) {
          logger.debug(`❌ Errore nell'estrazione card ${i + 1}:`, error.message);
        }
      }

      // Filtra offerte valide
      const validOffers = offers.filter(offer => {
        const isValid = this.isValidOffer(offer);
        if (!isValid) {
          logger.debug('🚫 Offerta scartata dai filtri:', { 
            brand: offer.brand, 
            model: offer.model, 
            price: offer.price,
            duration: offer.duration 
          });
        }
        return isValid;
      });

      logger.info(`📊 DriveFlee parsing completato: ${offers.length} offerte totali, ${validOffers.length} valide dopo filtri`);
      
      return validOffers.map(offer => ({
        ...offer,
        site: this.siteName
      }));
      
    } catch (error) {
      logger.error('❌ Errore durante il parsing delle offerte DriveFlee', { error: error.message });
      return [];
    }
  }

  async extractOfferFromCard(page, cardElement, cardIndex) {
    try {
      // Selettori basati sull'HTML di esempio fornito
      
      // Brand dal titolo h3: "Fiat Panda"
      const brandSelectors = [
        'h3.font-semibold',
        'h3[class*="font-semibold"]',
        'h3',
        '[class*="text-[28px]"][class*="font-semibold"]'
      ];

      // Modello dalla descrizione: "Panda 1.0 firefly hybrid s&s 70cv 5p.ti"
      const modelDescSelectors = [
        '.text-sm.tablet\\:text-base',
        'span[class*="text-sm"][class*="tablet:text-base"]',
        'span[class*="!leading-tight"]'
      ];

      // Prezzo mensile: "119"
      const priceSelectors = [
        '.font-bold.text-\\[40px\\]',
        'span[class*="font-bold"][class*="text-[40px]"]',
        'span[class*="text-[64px]"][class*="font-bold"]'
      ];

      // Anticipo e durata dalle info in basso
      const infoSelectors = [
        '.mt-10.tablet\\:flex.hidden .text-base',
        'div[class*="mt-10"] span',
        '.mt-8 .text-base'
      ];

      // Estrai brand
      const brandElement = await this.findElementBySelectors(cardElement, brandSelectors);
      const brandText = brandElement ? this.cleanText(await brandElement.textContent()) : '';
      
      // Estrai descrizione modello
      const modelDescElement = await this.findElementBySelectors(cardElement, modelDescSelectors);
      const modelDescText = modelDescElement ? this.cleanText(await modelDescElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Brand: "${brandText}", ModelDesc: "${modelDescText}"`);
      
      if (!brandText) {
        logger.debug(`⚠️ Card ${cardIndex}: brand non trovato`);
        return null;
      }

      // Parsing brand e modello completo
      const brand = brandText.split(' ')[0].toUpperCase(); // Es: "FIAT" da "Fiat Panda"
      const brandModel = brandText; // "Fiat Panda"
      const fullModel = modelDescText ? `${brandModel} ${modelDescText}` : brandModel;
      
      // Estrai prezzo
      const priceElement = await this.findElementBySelectors(cardElement, priceSelectors);
      const priceText = priceElement ? this.cleanText(await priceElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Prezzo raw: "${priceText}"`);
      
      const price = this.extractPrice(priceText);
      if (!price) {
        logger.debug(`⚠️ Card ${cardIndex}: prezzo non valido: "${priceText}"`);
        return null;
      }

      // Estrai anticipo e durata dalle info
      let anticipo = null;
      let duration = null;

      // Prova a trovare le info sia nella versione desktop che mobile
      const allInfoElements = await cardElement.$$('.text-base, span');
      for (const infoElement of allInfoElements) {
        try {
          const infoText = await infoElement.textContent();
          if (infoText) {
            const cleanInfo = this.cleanText(infoText);
            
            // Cerca anticipo: "Anticipo: 2.500 €"
            if (cleanInfo.includes('Anticipo:') || cleanInfo.includes('anticipo:')) {
              const anticipoMatch = cleanInfo.match(/anticipo[:\s]*([0-9.,]+)\s*€/i);
              if (anticipoMatch) {
                anticipo = `€${anticipoMatch[1]}`;
              }
            }
            
            // Cerca durata: "Durata: 48 mesi"
            if (cleanInfo.includes('Durata:') || cleanInfo.includes('durata:')) {
              const durationMatch = cleanInfo.match(/durata[:\s]*(\d+)\s*mesi/i);
              if (durationMatch) {
                duration = parseInt(durationMatch[1]);
              }
            }
          }
        } catch (error) {
          // Continua con il prossimo elemento
        }
      }
      
      // Default se non trovata durata
      if (!duration) {
        duration = 48;
        logger.debug(`🔍 Card ${cardIndex}: durata non trovata, uso default 48 mesi`);
      }

      const offer = {
        brand: brand,
        model: this.cleanText(fullModel),
        price: price,
        duration: duration,
        anticipo: anticipo,
        originalPrice: priceText,
        originalBrand: brandText,
        originalModelDesc: modelDescText
      };

      logger.debug(`✅ Card ${cardIndex}: offerta estratta`, offer);
      return offer;

    } catch (error) {
      logger.error(`❌ Errore nell'estrazione della card ${cardIndex}:`, error.message);
      return null;
    }
  }

  async findElementBySelectors(parentElement, selectors) {
    for (const selector of selectors) {
      try {
        const element = await parentElement.$(selector);
        if (element) {
          return element;
        }
      } catch (error) {
        // Continua con il prossimo selettore
      }
    }
    return null;
  }
}

module.exports = DriveFleeParser;