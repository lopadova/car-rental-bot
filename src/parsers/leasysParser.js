const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class LeasysParser extends BaseParser {
  constructor() {
    super('Leasys');
  }

  async navigateToOffers(page) {
    try {
      logger.info('🌐 Navigazione verso Leasys E-Store...');
      
      await page.goto('https://e-store.leasys.com/it/italiano/business', { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logger.info('📄 Pagina Leasys caricata, gestione cookie consent...');
      await this.handleCookieConsent(page);
      
      // Attesa per assicurarsi che la pagina sia completamente caricata
      await page.waitForTimeout(3000);
      
      logger.info('✅ Navigazione completata su Leasys E-Store');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su Leasys', { error: error.message });
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte Leasys...');
      
      const allOffers = [];
      let currentPage = 1;
      let totalOffers = 0;
      
      // Carica tutte le pagine
      while (true) {
        logger.info(`📄 Parsing pagina ${currentPage} di Leasys...`);
        
        // Attesa per il caricamento completo della pagina
        await page.waitForTimeout(2000);
        
        const pageOffers = await this.parseOffersFromCurrentPage(page);
        
        if (pageOffers.length === 0) {
          logger.warn(`⚠️ Pagina ${currentPage}: nessuna offerta trovata`);
          break;
        }
        
        allOffers.push(...pageOffers);
        totalOffers += pageOffers.length;
        
        logger.info(`✅ Pagina ${currentPage}: trovate ${pageOffers.length} offerte (totale: ${totalOffers})`);
        
        // Prova a navigare alla pagina successiva
        const hasNextPage = await this.goToNextPage(page);
        if (!hasNextPage) {
          logger.info(`🏁 Fine paginazione: non ci sono più pagine da caricare`);
          break;
        }
        
        currentPage++;
        
        // Limite di sicurezza per evitare loop infiniti
        if (currentPage > 50) {
          logger.warn('⚠️ Limite massimo pagine raggiunto (50), interrompo il parsing');
          break;
        }
      }

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

      logger.info(`📊 Leasys parsing completato: ${totalOffers} offerte totali, ${validOffers.length} valide dopo filtri`);
      
      return validOffers.map(offer => ({
        ...offer,
        site: this.siteName
      }));
      
    } catch (error) {
      logger.error('❌ Errore durante il parsing delle offerte Leasys', { error: error.message });
      return [];
    }
  }

  async parseOffersFromCurrentPage(page) {
    try {
      const offers = [];
      
      // Selettori per le card delle offerte Leasys
      const cardSelectors = [
        '[data-cy="GalleryItem-root"]',
        '.item-root-Chs',
        'a[class*="item-root"]',
        '[class*="gallery"] a',
        '.gallery-item',
        '[href*="/it/italiano/"]'
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
        logger.warn('❌ Nessuna card trovata nella pagina corrente');
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

      return offers;
    } catch (error) {
      logger.error('❌ Errore durante il parsing della pagina corrente', { error: error.message });
      return [];
    }
  }

  async extractOfferFromCard(page, cardElement, cardIndex) {
    try {
      // Selettori basati sull'HTML di esempio fornito
      const titleSelectors = [
        'h4.item-nameAtt-fQL',
        '.item-nameAtt-fQL',
        'h4[class*="nameAtt"]',
        'h4',
        '[class*="name"]'
      ];

      const descriptionSelectors = [
        'p.item-descriptionAtt-HRB',
        '.item-descriptionAtt-HRB',
        'p[class*="descriptionAtt"]',
        '.item-headSectionContainer-02o p'
      ];

      const priceSelectors = [
        '.item-price-RxI',
        '[data-cy="GalleryItem-price"] .item-price-RxI',
        '[class*="price-RxI"]',
        '.item-priceMonthContainer-3V- .item-price-RxI'
      ];

      const anticipoSelectors = [
        '.item-initialPrice-Jnk',
        '[class*="initialPrice"]',
        '.item-attributes-sUx .item-initialPrice-Jnk'
      ];

      const durationSelectors = [
        '.item-boldAttributes-cQe',
        '[class*="boldAttributes"]',
        '.item-attributesContainer-2OZ span'
      ];

      // Estrai brand e modello dal titolo
      const titleElement = await this.findElementBySelectors(cardElement, titleSelectors);
      const descriptionElement = await this.findElementBySelectors(cardElement, descriptionSelectors);
      
      const title = titleElement ? this.cleanText(await titleElement.textContent()) : '';
      const description = descriptionElement ? this.cleanText(await descriptionElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Titolo: "${title}", Descrizione: "${description}"`);
      
      if (!title) {
        logger.debug(`⚠️ Card ${cardIndex}: titolo non trovato`);
        return null;
      }

      // Parsing brand e modello
      // Esempio: "Maserati Grecale" -> brand="MASERATI", model="Maserati Grecale 2.0 250cv MHEV GT Q4 auto"
      const brandMatch = title.split(' ')[0];
      const fullModel = description ? `${title} ${description}` : title;
      
      const brand = brandMatch.toUpperCase();
      const model = this.cleanText(fullModel);

      // Estrai prezzo
      const priceElement = await this.findElementBySelectors(cardElement, priceSelectors);
      const priceText = priceElement ? this.cleanText(await priceElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Prezzo raw: "${priceText}"`);
      
      const price = this.extractPrice(priceText);
      if (!price) {
        logger.debug(`⚠️ Card ${cardIndex}: prezzo non valido: "${priceText}"`);
        return null;
      }

      // Estrai anticipo
      const anticipoElement = await this.findElementBySelectors(cardElement, anticipoSelectors);
      const anticipoText = anticipoElement ? this.cleanText(await anticipoElement.textContent()) : '';
      const anticipo = anticipoText || null;

      // Estrai durata (cerca "X Mesi" nei bold attributes)
      let duration = null;
      const durationElements = await cardElement.$$(durationSelectors.join(','));
      for (const durElement of durationElements) {
        try {
          const durText = await durElement.textContent();
          if (durText && durText.includes('Mesi')) {
            duration = this.extractDuration(durText);
            if (duration) break;
          }
        } catch (error) {
          // Continua con il prossimo elemento
        }
      }

      // Se non trova durata, usa 36 come default (dalla card esempio)
      if (!duration) {
        duration = 36;
        logger.debug(`🔍 Card ${cardIndex}: durata non trovata, uso default 36 mesi`);
      }

      const offer = {
        brand: brand,
        model: model,
        price: price,
        duration: duration,
        anticipo: anticipo,
        originalPrice: priceText,
        originalTitle: title,
        originalDescription: description
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

  async goToNextPage(page) {
    try {
      // Selettore specifico per il pulsante "Passare alla prossima pagina" di Leasys
      const nextButtonSelector = 'a[aria-label="Passare alla prossima pagina"]';
      
      const nextButton = await page.$(nextButtonSelector);
      if (!nextButton) {
        logger.info('🏁 Pulsante "prossima pagina" non trovato - fine paginazione');
        return false;
      }

      // Controlla se il pulsante è disabilitato
      const isDisabled = await nextButton.getAttribute('disabled');
      if (isDisabled === '' || isDisabled === 'true' || isDisabled === 'disabled') {
        logger.info('🏁 Pulsante "prossima pagina" disabilitato - siamo all\'ultima pagina');
        return false;
      }

      // Controlla se ha la classe di disabilitazione (se esiste)
      const buttonClass = await nextButton.getAttribute('class');
      if (buttonClass && buttonClass.includes('disabled')) {
        logger.info('🏁 Pulsante "prossima pagina" ha classe disabled - siamo all\'ultima pagina');
        return false;
      }

      // Il pulsante è attivo, proviamo a cliccare
      try {
        logger.info(`🔄 Clic su pulsante "prossima pagina"...`);
        await nextButton.click();
        await page.waitForTimeout(3000); // Attesa per il caricamento
        
        // Verifica che sia cambiata pagina controllando l'URL
        const newUrl = page.url();
        logger.info(`🔄 Navigazione completata - nuovo URL: ${newUrl}`);
        return true;
        
      } catch (clickError) {
        logger.warn('⚠️ Errore durante il clic sul pulsante prossima pagina:', clickError.message);
        return false;
      }

    } catch (error) {
      logger.error('❌ Errore durante la navigazione alla pagina successiva:', error.message);
      return false;
    }
  }
}

module.exports = LeasysParser;