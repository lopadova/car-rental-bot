const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class AlphabetParser extends BaseParser {
  constructor() {
    super('Alphabet');
  }

  async navigateToOffers(page) {
    try {
      logger.info('🌐 Navigazione verso Alphabet...');
      
      await page.goto('https://www.alphabet.com/it-it/offerte-di-noleggio-lungo-termine', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logger.info('📄 Pagina Alphabet caricata, gestione cookie consent...');
      await this.handleCookieConsent(page);
      
      // Attesa per assicurarsi che la pagina sia completamente caricata
      await page.waitForTimeout(3000);
      
      logger.info('✅ Navigazione completata su Alphabet - pronto per parsing offerte');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su Alphabet', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte Alphabet (pagina singola)...');
      
      // Attesa per il caricamento completo della pagina
      await page.waitForTimeout(2000);
      
      const offers = [];
      
      // Selettori per le card delle offerte Alphabet basati sull'HTML fornito
      const cardSelectors = [
        '.css-1ksh4mb',
        'div[class*="css-"][class*="e12nztud0"]',
        'div[class*="e12nztud"]',
        '[class*="ksh4mb"]',
        // Selettori più generici come fallback
        'div:has(h2)',
        'div:has(.css-12g9gg)',
        '.offer-card',
        '.car-card'
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

      logger.info(`📊 Alphabet parsing completato: ${offers.length} offerte totali, ${validOffers.length} valide dopo filtri`);
      
      return validOffers.map(offer => ({
        ...offer,
        site: this.siteName
      }));
      
    } catch (error) {
      logger.error('❌ Errore durante il parsing delle offerte Alphabet', { error: error.message });
      return [];
    }
  }

  async extractOfferFromCard(page, cardElement, cardIndex) {
    try {
      // Selettori basati sull'HTML di esempio fornito
      
      // Durata e anticipo dalla prima riga: "36 mesi | 45.000 Km | anticipo: 1.229€ i.e"
      const infoSelectors = [
        '.css-ojgtdj',
        'p[class*="css-"][class*="e12nztud1"]',
        '[class*="ojgtdj"]'
      ];

      // Brand dal titolo h2: "BMW SERIE 1"
      const brandSelectors = [
        '.css-12g9gg',
        'h2[class*="css-"][class*="e12nztud3"]',
        'h2[class*="12g9gg"]',
        'h2'
      ];

      // Modello dalla descrizione: "118d MSport Pro 150 CV automatic"
      const modelDescSelectors = [
        '.css-ycna0z',
        'p[class*="css-"][class*="e12nztud4"]',
        '[class*="ycna0z"]'
      ];

      // Prezzo dal div: "399€ /mese i.e"
      const priceSelectors = [
        '.css-gywyzp p',
        'div[class*="css-"][class*="e12nztud5"] p',
        '[class*="gywyzp"] p'
      ];

      // Estrai informazioni durata e anticipo
      const infoElement = await this.findElementBySelectors(cardElement, infoSelectors);
      const infoText = infoElement ? this.cleanText(await infoElement.textContent()) : '';
      
      // Estrai brand
      const brandElement = await this.findElementBySelectors(cardElement, brandSelectors);
      const brandText = brandElement ? this.cleanText(await brandElement.textContent()) : '';
      
      // Estrai descrizione modello
      const modelDescElement = await this.findElementBySelectors(cardElement, modelDescSelectors);
      const modelDescText = modelDescElement ? this.cleanText(await modelDescElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Info: "${infoText}", Brand: "${brandText}", ModelDesc: "${modelDescText}"`);
      
      if (!brandText) {
        logger.debug(`⚠️ Card ${cardIndex}: brand non trovato`);
        return null;
      }

      // Parsing brand e modello completo
      const brand = brandText.split(' ')[0].toUpperCase(); // Es: "BMW" da "BMW SERIE 1"
      const brandModel = brandText; // "BMW SERIE 1"
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

      // Estrai durata dalle info (es: "36 mesi | 45.000 Km | anticipo: 1.229€ i.e")
      let duration = null;
      if (infoText.includes('mesi')) {
        const durationMatch = infoText.match(/(\d+)\s*mesi/i);
        if (durationMatch) {
          duration = parseInt(durationMatch[1]);
        }
      }
      
      // Default se non trovata
      if (!duration) {
        duration = 48;
        logger.debug(`🔍 Card ${cardIndex}: durata non trovata, uso default 48 mesi`);
      }

      // Estrai anticipo dalle info
      let anticipo = null;
      if (infoText.includes('anticipo')) {
        const anticipoMatch = infoText.match(/anticipo[:\s]*([0-9.,]+)\s*€/i);
        if (anticipoMatch) {
          anticipo = `€${anticipoMatch[1]}`;
        }
      }

      const offer = {
        brand: brand,
        model: this.cleanText(fullModel),
        price: price,
        duration: duration,
        anticipo: anticipo,
        originalPrice: priceText,
        originalInfo: infoText,
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

module.exports = AlphabetParser;