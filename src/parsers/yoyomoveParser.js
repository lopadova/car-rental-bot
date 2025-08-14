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
      
      // Prima carica la pagina con waitUntil più permissivo
      await page.goto(url, { 
        waitUntil: 'domcontentloaded',
        timeout: 30000 
      });

      logger.info('📄 Pagina YoyoMove caricata, gestione cookie consent specifico...');
      
      // Gestione cookie consent specifica per YoyoMove
      await this.handleYoyoMoveCookieConsent(page);
      
      // Attesa per contenuto dinamico
      await page.waitForTimeout(5000);
      
      // Verifica se ci sono offerte caricate
      await this.waitForOffersToLoad(page);
      
      logger.info('✅ Navigazione completata su YoyoMove - pronto per parsing offerte');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su YoyoMove', { error: error.message });
      return false;
    }
  }

  async handleYoyoMoveCookieConsent(page) {
    try {
      logger.info('🍪 Gestione cookie consent specifico per YoyoMove...');
      
      // Selettori specifici per YoyoMove basati sull'errore riportato
      const yoyoMoveCookieSelectors = [
        // Il pulsante specifico che hai identificato
        'button.qc-cmp2-close-icon',
        'button[aria-label="RIFIUTA TUTTO"]',
        'button.qc-cmp2-close-icon[aria-label="RIFIUTA TUTTO"]',
        // Altri selettori della famiglia qc-cmp2
        'button[class*="qc-cmp2"]',
        'button[id*="qc-cmp2"]',
        '[id="qc-cmp2-container"] button',
        '.qc-cmp2-container button',
        // Selettori generici per popup overlay
        '.cookie-banner button',
        '.cookie-consent button',
        '.gdpr-banner button',
        '.privacy-banner button',
        // Selettori per testo specifico
        'button:has-text("RIFIUTA TUTTO")',
        'button:has-text("Rifiuta tutto")',
        'button:has-text("Accetta tutti")',
        'button:has-text("Accept all")',
        'button:has-text("Accetta")',
        'button:has-text("Accept")',
        'button:has-text("OK")',
        'button:has-text("Chiudi")',
        // Selettori fallback più generici
        'button[data-action="accept"]',
        'button[data-accept="true"]',
        'div[class*="cookie"] button',
        'div[id*="cookie"] button'
      ];

      // Prova per 20 secondi con più tentativi
      const timeout = 20000;
      const startTime = Date.now();
      
      while (Date.now() - startTime < timeout) {
        for (const selector of yoyoMoveCookieSelectors) {
          try {
            const button = await page.$(selector);
            if (button) {
              const isVisible = await button.isVisible();
              const isEnabled = await button.isEnabled();
              
              if (isVisible && isEnabled) {
                logger.info(`🔘 Tentativo click su cookie button: ${selector}`);
                
                // Prova diversi metodi di click
                try {
                  await button.click({ force: true });
                } catch (clickError) {
                  // Se il click normale fallisce, prova con JavaScript
                  logger.info('🔧 Click normale fallito, provo con JavaScript...');
                  await page.evaluate(sel => {
                    const el = document.querySelector(sel);
                    if (el) el.click();
                  }, selector);
                }
                
                await page.waitForTimeout(3000);
                
                // Verifica se il popup è sparito controllando l'elemento container
                const containerGone = await page.$('#qc-cmp2-container').then(el => !el).catch(() => true);
                if (containerGone) {
                  logger.info(`✅ Cookie popup chiuso con successo su YoyoMove`);
                  return true;
                }
              }
            }
          } catch (error) {
            logger.debug(`⚠️ Errore con selettore cookie ${selector}:`, error.message);
          }
        }
        
        // Prova click fuori dal banner come suggerito
        try {
          logger.info('🔘 Tentativo click fuori dal banner cookie...');
          await page.click('body', { position: { x: 50, y: 50 } });
          await page.waitForTimeout(2000);
          
          const containerGone = await page.$('#qc-cmp2-container').then(el => !el).catch(() => true);
          if (containerGone) {
            logger.info(`✅ Cookie popup chiuso cliccando fuori dal banner`);
            return true;
          }
        } catch (error) {
          logger.debug('⚠️ Errore nel click fuori dal banner:', error.message);
        }
        
        // Prova rimozione forzata JavaScript più aggressiva
        try {
          await page.evaluate(() => {
            // Rimuovi specificamente il container qc-cmp2
            const qcContainer = document.querySelector('#qc-cmp2-container');
            if (qcContainer) {
              qcContainer.remove();
              console.log('Rimosso qc-cmp2-container');
            }
            
            // Rimuovi tutti gli elementi con classi qc-cmp
            const qcElements = document.querySelectorAll('[class*="qc-cmp"], [id*="qc-cmp"]');
            qcElements.forEach(el => el.remove());
            
            // Rimuovi overlay generici
            const overlays = document.querySelectorAll('.overlay, .modal-backdrop, [class*="backdrop"], [class*="cleanslate"]');
            overlays.forEach(el => el.remove());
            
            // Rimuovi elementi che intercettano pointer events
            const blockers = document.querySelectorAll('[style*="pointer-events"], .qc-cmp-cleanslate');
            blockers.forEach(el => el.remove());
          });
          
          logger.info('🔧 Forzata rimozione popup via JavaScript aggressiva');
          await page.waitForTimeout(2000);
          
          // Verifica se ora il container è sparito
          const containerGone = await page.$('#qc-cmp2-container').then(el => !el).catch(() => true);
          if (containerGone) {
            logger.info(`✅ Cookie popup rimosso forzatamente con JavaScript`);
            return true;
          }
          
        } catch (error) {
          logger.debug('⚠️ Errore nella rimozione JavaScript:', error.message);
        }
        
        await page.waitForTimeout(1000);
      }

      // Ultimo tentativo: rimozione forzata definitiva
      try {
        logger.info('🚨 Ultimo tentativo: rimozione definitiva popup...');
        await page.evaluate(() => {
          // Rimuovi tutto quello che può bloccare
          document.querySelectorAll('[id*="qc-"], [class*="qc-"], [data-nosnippet]').forEach(el => el.remove());
          document.querySelectorAll('div[height="1080"]').forEach(el => el.remove());
          
          // Riabilita pointer events su tutto
          document.body.style.pointerEvents = 'auto';
          document.documentElement.style.pointerEvents = 'auto';
        });
        
        await page.waitForTimeout(2000);
        logger.info('✅ Completata rimozione forzata, procedendo...');
        return true;
        
      } catch (error) {
        logger.warn('⚠️ Cookie popup non gestito completamente, procedendo comunque...');
        return false;
      }
      
    } catch (error) {
      logger.error('❌ Errore nella gestione cookie YoyoMove:', error.message);
      return false;
    }
  }

  async waitForOffersToLoad(page) {
    try {
      logger.info('⏳ Attesa caricamento offerte YoyoMove...');
      
      // Selettori per verificare che le offerte siano caricate
      const offerSelectors = [
        '.simple-card',
        'a.simple-card',
        '.offer-card',
        '[class*="simple-card"]'
      ];
      
      // Aspetta fino a 20 secondi per il caricamento delle offerte
      for (const selector of offerSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 20000 });
          logger.info(`✅ Offerte caricate su YoyoMove (trovato: ${selector})`);
          return true;
        } catch (error) {
          logger.debug(`⚠️ Selettore offerte non trovato: ${selector}`);
        }
      }
      
      logger.warn('⚠️ Nessuna offerta trovata entro il timeout, procedendo comunque...');
      return false;
      
    } catch (error) {
      logger.error('❌ Errore nell\'attesa delle offerte:', error.message);
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte YoyoMove con paginazione...');
      
      const allOffers = [];
      let currentPage = 1;
      let hasMorePages = true;
      let consecutiveEmptyPages = 0;
      const maxEmptyPages = 2; // Fermati dopo 2 pagine consecutive senza offerte valide
      
      while (hasMorePages && currentPage <= 15) { // Limite massimo di sicurezza a 15 pagine
        logger.info(`📄 Parsing pagina ${currentPage}...`);
        
        // Attesa per il caricamento della pagina
        await page.waitForTimeout(2000);
        
        // Estrai offerte dalla pagina corrente
        const pageOffers = await this.extractOffersFromPage(page, currentPage);
        
        // Controlla se la pagina ha offerte valide
        if (pageOffers.length > 0) {
          allOffers.push(...pageOffers);
          consecutiveEmptyPages = 0; // Reset contatore pagine vuote
          logger.info(`📋 Pagina ${currentPage}: ${pageOffers.length} offerte trovate`);
        } else {
          consecutiveEmptyPages++;
          logger.info(`📋 Pagina ${currentPage}: 0 offerte trovate (pagine vuote consecutive: ${consecutiveEmptyPages})`);
          
          // Se abbiamo trovato troppe pagine vuote consecutive, probabilmente siamo alla fine
          if (consecutiveEmptyPages >= maxEmptyPages) {
            logger.info(`🛑 Trovate ${consecutiveEmptyPages} pagine consecutive senza offerte, terminando paginazione`);
            hasMorePages = false;
            break;
          }
        }
        
        // Verifica se c'è una pagina successiva
        if (hasMorePages) {
          hasMorePages = await this.navigateToNextPage(page, currentPage);
          
          if (hasMorePages) {
            currentPage++;
            // Attesa tra le pagine
            await page.waitForTimeout(2000);
          }
        }
      }
      
      if (currentPage > 15) {
        logger.warn('⚠️ Raggiunto limite massimo di 15 pagine, terminando per sicurezza');
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
      // Prima controlla se siamo già all'ultima pagina leggendo i link di paginazione
      const isLastPage = await this.checkIfLastPage(page, currentPage);
      if (isLastPage) {
        logger.info(`📊 Pagina ${currentPage} è l'ultima pagina disponibile secondo la paginazione`);
        return false;
      }
      
      // Prima assicurati che il popup cookie sia completamente rimosso
      await this.ensureCookiePopupRemoved(page);
      
      // Selettori per il pulsante della pagina successiva basati sull'HTML fornito
      const nextPageSelectors = [
        // Selettore specifico per il link "next" che hai mostrato
        'a.pagination__page-link--next',
        '.pagination__page-link--next',
        // Selettori per pagina specifica
        `a.pagination__page[data-page-target="${currentPage + 1}"]`,
        `a[data-page-target="${currentPage + 1}"]`,
        `a[href*="page=${currentPage + 1}"]`,
        // Selettori più generici
        '.pagination__page-link[data-page-target]',
        'a[class*="pagination__page-link--next"]'
      ];

      for (const selector of nextPageSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            const isVisible = await nextButton.isVisible();
            const isEnabled = await nextButton.isEnabled();
            
            if (isVisible && isEnabled) {
              logger.info(`🔄 Navigazione alla pagina ${currentPage + 1} con selettore: ${selector}`);
              
              // Prova diversi metodi di click
              let clickSuccess = false;
              
              // Metodo 1: Click normale
              try {
                await nextButton.click();
                clickSuccess = true;
                logger.info('✅ Click normale riuscito');
              } catch (clickError) {
                logger.debug('⚠️ Click normale fallito:', clickError.message);
                
                // Metodo 2: Click forzato
                try {
                  await nextButton.click({ force: true });
                  clickSuccess = true;
                  logger.info('✅ Click forzato riuscito');
                } catch (forceError) {
                  logger.debug('⚠️ Click forzato fallito:', forceError.message);
                  
                  // Metodo 3: Click via JavaScript
                  try {
                    await page.evaluate(sel => {
                      const el = document.querySelector(sel);
                      if (el) el.click();
                    }, selector);
                    clickSuccess = true;
                    logger.info('✅ Click JavaScript riuscito');
                  } catch (jsError) {
                    logger.debug('⚠️ Click JavaScript fallito:', jsError.message);
                  }
                }
              }
              
              if (clickSuccess) {
                // Attesa per il caricamento della nuova pagina
                await page.waitForTimeout(5000);
                
                // Verifica che la pagina sia effettivamente cambiata
                const currentUrl = page.url();
                if (currentUrl.includes(`page=${currentPage + 1}`)) {
                  logger.info(`✅ Navigazione alla pagina ${currentPage + 1} completata`);
                  
                  // Rimuovi eventuali popup che potrebbero riapparire
                  await this.ensureCookiePopupRemoved(page);
                  
                  return true;
                }
              }
            }
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore next page ${selector}:`, error.message);
        }
      }
      
      // Metodo alternativo: navigazione diretta tramite URL
      try {
        logger.info(`🔄 Tentativo navigazione diretta alla pagina ${currentPage + 1}...`);
        
        const currentUrl = page.url();
        let nextPageUrl;
        
        if (currentUrl.includes('page=')) {
          // Sostituisci il numero di pagina esistente
          nextPageUrl = currentUrl.replace(/page=\d+/, `page=${currentPage + 1}`);
        } else {
          // Aggiungi il parametro page
          const separator = currentUrl.includes('?') ? '&' : '?';
          nextPageUrl = `${currentUrl}${separator}page=${currentPage + 1}`;
        }
        
        await page.goto(nextPageUrl, { 
          waitUntil: 'domcontentloaded', 
          timeout: 30000 
        });
        
        // Attesa per il caricamento
        await page.waitForTimeout(5000);
        
        // Rimuovi popup che potrebbero riapparire
        await this.ensureCookiePopupRemoved(page);
        
        // Verifica caricamento offerte
        await this.waitForOffersToLoad(page);
        
        logger.info(`✅ Navigazione diretta alla pagina ${currentPage + 1} completata`);
        return true;
        
      } catch (directNavError) {
        logger.debug(`⚠️ Navigazione diretta fallita:`, directNavError.message);
      }
      
      logger.info(`📊 Impossibile navigare alla pagina ${currentPage + 1} - terminando paginazione`);
      return false;
      
    } catch (error) {
      logger.error(`❌ Errore durante la navigazione alla pagina successiva:`, error.message);
      return false;
    }
  }

  async checkIfLastPage(page, currentPage) {
    try {
      // Controlla se esiste il link alla pagina successiva
      const nextPageExists = await page.$(`a.pagination__page[data-page-target="${currentPage + 1}"]`);
      if (!nextPageExists) {
        logger.info(`📊 Nessun link trovato per la pagina ${currentPage + 1}`);
        
        // Controlla anche il pulsante "next" generico
        const nextButtonExists = await page.$('a.pagination__page-link--next');
        if (!nextButtonExists) {
          logger.info('📊 Nessun pulsante "next" trovato');
          return true;
        }
        
        // Se il pulsante next esiste, verifica se è disabilitato o nascosto
        const nextButton = nextButtonExists;
        const isVisible = await nextButton.isVisible();
        const isEnabled = await nextButton.isEnabled();
        
        if (!isVisible || !isEnabled) {
          logger.info('📊 Pulsante "next" disabilitato o nascosto');
          return true;
        }
      }
      
      // Controlla il numero massimo di pagine dal link all'ultima pagina
      const lastPageLink = await page.$('a.pagination__pages-group-link--next');
      if (lastPageLink) {
        const href = await lastPageLink.getAttribute('href');
        if (href) {
          const match = href.match(/page=(\d+)/);
          if (match) {
            const maxPage = parseInt(match[1]);
            if (currentPage >= maxPage) {
              logger.info(`📊 Raggiunta l'ultima pagina: ${currentPage}/${maxPage}`);
              return true;
            }
          }
        }
      }
      
      return false;
      
    } catch (error) {
      logger.debug('⚠️ Errore nel controllo ultima pagina:', error.message);
      return false;
    }
  }

  async ensureCookiePopupRemoved(page) {
    try {
      // Verifica se il popup è ancora presente e rimuovilo
      const popupPresent = await page.$('#qc-cmp2-container').then(el => !!el).catch(() => false);
      
      if (popupPresent) {
        logger.info('🧹 Popup cookie ancora presente, rimuovendolo...');
        await page.evaluate(() => {
          // Rimozione aggressiva di tutti gli elementi qc-cmp
          document.querySelectorAll('[id*="qc-"], [class*="qc-"], [data-nosnippet]').forEach(el => el.remove());
          document.querySelectorAll('div[height="1080"]').forEach(el => el.remove());
          
          // Riabilita pointer events
          document.body.style.pointerEvents = 'auto';
          document.documentElement.style.pointerEvents = 'auto';
          
          // Rimuovi eventuali overlay che bloccano
          const overlays = document.querySelectorAll('.overlay, [class*="backdrop"], [class*="cleanslate"]');
          overlays.forEach(el => el.remove());
        });
        
        await page.waitForTimeout(1000);
        logger.info('✅ Popup rimosso forzatamente');
      }
    } catch (error) {
      logger.debug('⚠️ Errore nella verifica/rimozione popup:', error.message);
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