const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class YoyoMoveParser extends BaseParser {
  constructor() {
    super('YoyoMove');
  }

  async navigateToOffers(page) {
    try {
      logger.info('🌐 Navigazione verso YoyoMove...');
      
      // URL con parametri query
      const url = 'https://www.yoyomove.com/it/offerte-noleggio-lungo-termine-aziende/?database_id=g_it_search_generic_nlt_exact';
      
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logger.info('📄 Pagina YoyoMove caricata, gestione cookie consent...');
      await this.handleCookieConsent(page);
      
      // Attesa per assicurarsi che la pagina sia completamente caricata
      await page.waitForTimeout(3000);
      
      logger.info('✅ Navigazione completata su YoyoMove - pronto per parsing offerte');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su YoyoMove', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte YoyoMove con paginazione...');
      
      const allOffers = [];
      let currentPage = 1;
      let hasMorePages = true;
      
      while (hasMorePages) {
        logger.info(`📄 Parsing pagina ${currentPage}...`);
        
        // Attesa per il caricamento della pagina
        await page.waitForTimeout(2000);
        
        // Estrai offerte dalla pagina corrente
        const pageOffers = await this.extractOffersFromPage(page, currentPage);
        allOffers.push(...pageOffers);
        
        logger.info(`📋 Pagina ${currentPage}: ${pageOffers.length} offerte trovate`);
        
        // Verifica se c'è una pagina successiva
        hasMorePages = await this.navigateToNextPage(page, currentPage);
        
        if (hasMorePages) {
          currentPage++;
          // Attesa tra le pagine
          await page.waitForTimeout(2000);
        }
      }
      
      logger.info(`📊 Parsing completato: ${allOffers.length} offerte totali trovate su ${currentPage} pagine`);
      
      // Filtra offerte valide
      const validOffers = allOffers.filter(offer => {
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
      
      logger.info(`📊 YoyoMove parsing completato: ${allOffers.length} offerte totali, ${validOffers.length} valide dopo filtri`);
      
      return validOffers.map(offer => ({
        ...offer,
        site: this.siteName
      }));
      
    } catch (error) {
      logger.error('❌ Errore durante il parsing delle offerte YoyoMove', { error: error.message });
      return [];
    }
  }

  async extractOffersFromPage(page, pageNumber) {
    const offers = [];
    
    try {
      // Selettori per le card delle offerte YoyoMove
      const cardSelectors = [
        'a.simple-card',
        '.simple-card',
        'a[class*="simple-card"]',
        '[class*="simple-card"]',
        // Selettori più generici come fallback
        'a[href*="/offerte-noleggio-lungo-termine"]',
        '.offer-card',
        '.car-card'
      ];

      let cardElements = [];
      for (const selector of cardSelectors) {
        try {
          cardElements = await page.$$(selector);
          if (cardElements.length > 0) {
            logger.debug(`🔍 Pagina ${pageNumber}: trovate ${cardElements.length} card con selettore: ${selector}`);
            break;
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore ${selector}:`, error.message);
        }
      }

      if (cardElements.length === 0) {
        logger.warn(`❌ Nessuna card trovata nella pagina ${pageNumber}`);
        return offers;
      }

      logger.info(`📋 Pagina ${pageNumber}: ${cardElements.length} card da processare...`);

      // Estrai dati da ogni card
      for (let i = 0; i < cardElements.length; i++) {
        try {
          const offer = await this.extractOfferFromCard(page, cardElements[i], i + 1, pageNumber);
          if (offer) {
            offers.push(offer);
            logger.debug(`✅ Pagina ${pageNumber}, Card ${i + 1}/${cardElements.length}: estratta offerta`, { 
              brand: offer.brand, 
              model: offer.model, 
              price: offer.price 
            });
          } else {
            logger.debug(`⚠️ Pagina ${pageNumber}, Card ${i + 1}/${cardElements.length}: estrazione fallita`);
          }
        } catch (error) {
          logger.debug(`❌ Errore nell'estrazione card ${i + 1} dalla pagina ${pageNumber}:`, error.message);
        }
      }
      
    } catch (error) {
      logger.error(`❌ Errore durante l'estrazione offerte dalla pagina ${pageNumber}:`, error.message);
    }
    
    return offers;
  }

  async navigateToNextPage(page, currentPage) {
    try {
      // Selettori per il pulsante della pagina successiva
      const nextPageSelectors = [
        `a.pagination__page[data-page-target="${currentPage + 1}"]`,
        `a[href*="?page=${currentPage + 1}"]`,
        'a.pagination__page-link--next',
        '.pagination__page-link--next',
        `a[data-page-target="${currentPage + 1}"]`
      ];

      for (const selector of nextPageSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            const isVisible = await nextButton.isVisible();
            const isEnabled = await nextButton.isEnabled();
            
            if (isVisible && isEnabled) {
              logger.info(`🔄 Navigazione alla pagina ${currentPage + 1}...`);
              await nextButton.click();
              
              // Attesa per il caricamento della nuova pagina
              await page.waitForTimeout(3000);
              
              return true;
            }
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore next page ${selector}:`, error.message);
        }
      }
      
      // Controlla anche se esiste un link all'ultima pagina (per determinare il totale)
      const lastPageSelectors = [
        'a.pagination__pages-group-link--next',
        'a[class*="pagination__pages-group-link--next"]'
      ];
      
      for (const selector of lastPageSelectors) {
        try {
          const lastPageLink = await page.$(selector);
          if (lastPageLink) {
            const href = await lastPageLink.getAttribute('href');
            if (href) {
              const match = href.match(/page=(\d+)/);
              if (match && parseInt(match[1]) > currentPage) {
                logger.info(`📊 Trovate almeno ${match[1]} pagine totali`);
                // Prova a navigare direttamente alla pagina successiva
                const nextPageUrl = page.url().replace(/([?&])page=\d+/, `$1page=${currentPage + 1}`);
                const baseUrl = page.url().includes('?page=') ? 
                  nextPageUrl : 
                  `${page.url()}&page=${currentPage + 1}`;
                
                logger.info(`🔄 Navigazione diretta alla pagina ${currentPage + 1}...`);
                await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });
                return true;
              }
            }
          }
        } catch (error) {
          logger.debug(`⚠️ Errore nel controllo ultima pagina:`, error.message);
        }
      }
      
      logger.info(`📊 Pagina ${currentPage} è l'ultima pagina disponibile`);
      return false;
      
    } catch (error) {
      logger.error(`❌ Errore durante la navigazione alla pagina successiva:`, error.message);
      return false;
    }
  }

  async extractOfferFromCard(page, cardElement, cardIndex, pageNumber) {
    try {
      // Selettori basati sull'HTML di esempio fornito
      
      // Brand e modello dai div title e subtitle
      const titleSelectors = [
        '.simple-card__title',
        'div[class*="simple-card__title"]',
        '[class*="card__title"]'
      ];

      const subtitleSelectors = [
        '.simple-card__subtitle',
        'div[class*="simple-card__subtitle"]',
        '[class*="card__subtitle"]'
      ];

      // Prezzo dal div price
      const priceSelectors = [
        '.simple-card__price strong',
        '.simple-card__price',
        'div[class*="simple-card__price"] strong',
        '[class*="card__price"] strong'
      ];

      // Features (durata, km, anticipo) dal div features
      const featuresSelectors = [
        '.simple-card__features',
        'div[class*="simple-card__features"]',
        '[class*="card__features"]'
      ];

      // Estrai brand e modello
      const titleElement = await this.findElementBySelectors(cardElement, titleSelectors);
      const titleText = titleElement ? this.cleanText(await titleElement.textContent()) : '';
      
      const subtitleElement = await this.findElementBySelectors(cardElement, subtitleSelectors);
      const subtitleText = subtitleElement ? this.cleanText(await subtitleElement.textContent()) : '';
      
      logger.debug(`🔍 Pagina ${pageNumber}, Card ${cardIndex} - Title: "${titleText}", Subtitle: "${subtitleText}"`);
      
      if (!titleText) {
        logger.debug(`⚠️ Pagina ${pageNumber}, Card ${cardIndex}: brand/model non trovato`);
        return null;
      }

      // Parsing brand e modello
      const brand = titleText.split(' ')[0].toUpperCase(); // Es: "FIAT" da "Fiat Panda"
      const brandModel = titleText; // "Fiat Panda"
      const fullModel = subtitleText ? `${brandModel} ${subtitleText}` : brandModel;
      
      // Estrai prezzo
      const priceElement = await this.findElementBySelectors(cardElement, priceSelectors);
      const priceText = priceElement ? this.cleanText(await priceElement.textContent()) : '';
      
      logger.debug(`🔍 Pagina ${pageNumber}, Card ${cardIndex} - Prezzo raw: "${priceText}"`);
      
      const price = this.extractPrice(priceText);
      if (!price) {
        logger.debug(`⚠️ Pagina ${pageNumber}, Card ${cardIndex}: prezzo non valido: "${priceText}"`);
        return null;
      }

      // Estrai features (durata, anticipo)
      let duration = null;
      let anticipo = null;
      
      const featuresElement = await this.findElementBySelectors(cardElement, featuresSelectors);
      if (featuresElement) {
        const featuresText = this.cleanText(await featuresElement.textContent());
        logger.debug(`🔍 Pagina ${pageNumber}, Card ${cardIndex} - Features: "${featuresText}"`);
        
        // Cerca durata: "36 mesi"
        const durationMatch = featuresText.match(/(\d+)\s*mesi/i);
        if (durationMatch) {
          duration = parseInt(durationMatch[1]);
        }
        
        // Cerca anticipo: "Anticipo 3.500€"
        const anticipoMatch = featuresText.match(/anticipo\s*([0-9.,]+)\s*€/i);
        if (anticipoMatch) {
          anticipo = `€${anticipoMatch[1]}`;
        }
      }
      
      // Default se non trovata durata
      if (!duration) {
        duration = 48;
        logger.debug(`🔍 Pagina ${pageNumber}, Card ${cardIndex}: durata non trovata, uso default 48 mesi`);
      }

      const offer = {
        brand: brand,
        model: this.cleanText(fullModel),
        price: price,
        duration: duration,
        anticipo: anticipo,
        originalPrice: priceText,
        originalTitle: titleText,
        originalSubtitle: subtitleText
      };

      logger.debug(`✅ Pagina ${pageNumber}, Card ${cardIndex}: offerta estratta`, offer);
      return offer;

    } catch (error) {
      logger.error(`❌ Errore nell'estrazione della card ${cardIndex} dalla pagina ${pageNumber}:`, error.message);
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

module.exports = YoyoMoveParser;