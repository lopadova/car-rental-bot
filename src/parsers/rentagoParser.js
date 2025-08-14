const BaseParser = require('./baseParser');
const logger = require('../utils/logger');
const config = require('../config');

class RentagoParser extends BaseParser {
  constructor() {
    super('Rentago');
  }

  async navigateToOffers(page) {
    try {
      logger.info('🌐 Navigazione verso Rentago...');
      
      // Costruisci URL dinamico con MAX_PRICE dal config
      const maxPrice = config.scraping.maxPrice;
      const url = `https://www.rentago.it/noleggio-a-lungo-termine/?p0=toscana&p1=rata-a-${maxPrice}`;
      
      logger.info(`📍 URL Rentago: ${url}`);
      
      await page.goto(url, { 
        waitUntil: 'networkidle',
        timeout: 30000 
      });

      logger.info('📄 Pagina Rentago caricata, gestione cookie consent specifico...');
      
      // Gestione specifica per il popup cookiescript di Rentago
      await this.handleRentagoCookiePopup(page);
      
      // Prova anche il metodo generico nel caso
      await this.handleCookieConsent(page);
      
      // Attesa per assicurarsi che la pagina sia completamente caricata
      await page.waitForTimeout(3000);
      
      logger.info('✅ Navigazione completata su Rentago');
      return true;
    } catch (error) {
      logger.error('❌ Errore durante la navigazione su Rentago', { error: error.message });
      return false;
    }
  }

  async handleRentagoCookiePopup(page) {
    try {
      logger.info('🍪 Ricerca popup cookie specifico Rentago (cookiescript)...');
      
      // Selettori specifici per il popup cookiescript di Rentago
      const cookieSelectors = [
        // Pulsanti di accettazione nel popup cookiescript
        '#cookiescript_accept',
        '#cookiescript_accept_all',
        '#cookiescript_injected button[data-cs-accept]',
        '#cookiescript_injected button:has-text("Accetta")',
        '#cookiescript_injected button:has-text("Accept")',
        '#cookiescript_injected button:has-text("OK")',
        '#cookiescript_injected_wrapper button',
        '[data-cs-accept-all]',
        '[data-cs-accept]',
        // Selettori generici nel caso
        'button:has-text("Accetta tutto")',
        'button:has-text("Accept all")',
        'button:has-text("Accetto")'
      ];

      // Attendi che il popup appaia (massimo 5 secondi)
      try {
        await page.waitForSelector('#cookiescript_injected, #cookiescript_injected_wrapper', { 
          timeout: 5000,
          state: 'visible' 
        });
        logger.info('🍪 Popup cookiescript rilevato!');
      } catch (e) {
        logger.info('🍪 Nessun popup cookiescript rilevato (potrebbe essere già accettato)');
        return false;
      }

      // Prova a cliccare sui vari pulsanti di accettazione
      for (const selector of cookieSelectors) {
        try {
          const button = await page.$(selector);
          if (button) {
            const isVisible = await button.isVisible();
            if (isVisible) {
              logger.info(`🍪 Trovato pulsante cookie: ${selector}, provo a cliccare...`);
              
              // Usa force: true per forzare il click anche se c'è overlay
              await button.click({ force: true });
              
              logger.info(`✅ Cookie accettati con selettore: ${selector}`);
              
              // Attendi che il popup scompaia
              await page.waitForTimeout(2000);
              
              // Verifica che il popup sia scomparso
              const popupStillVisible = await page.$('#cookiescript_injected:visible, #cookiescript_injected_wrapper:visible');
              if (!popupStillVisible) {
                logger.info('✅ Popup cookie rimosso con successo');
                return true;
              }
            }
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore ${selector}: ${error.message}`);
        }
      }

      // Se ancora visibile, prova a nasconderlo via JavaScript
      try {
        logger.info('🍪 Tentativo di rimozione popup via JavaScript...');
        await page.evaluate(() => {
          const popup1 = document.querySelector('#cookiescript_injected');
          const popup2 = document.querySelector('#cookiescript_injected_wrapper');
          const overlay = document.querySelector('.cookiescript_overlay');
          
          if (popup1) popup1.style.display = 'none';
          if (popup2) popup2.style.display = 'none';
          if (overlay) overlay.style.display = 'none';
          
          // Rimuovi anche l'attributo che blocca lo scroll
          document.body.style.overflow = 'auto';
          document.documentElement.style.overflow = 'auto';
        });
        
        logger.info('✅ Popup cookie nascosto via JavaScript');
        return true;
      } catch (error) {
        logger.warn('⚠️ Non riuscito a nascondere popup via JavaScript');
      }

      logger.warn('⚠️ Non riuscito a gestire completamente il popup cookie');
      return false;
      
    } catch (error) {
      logger.error('❌ Errore nella gestione del popup cookie Rentago:', error.message);
      return false;
    }
  }

  async parseOffers(page) {
    try {
      logger.info('🔍 Inizio parsing offerte Rentago...');
      
      const allOffers = [];
      let currentPage = 1;
      let totalOffers = 0;
      
      // Carica tutte le pagine
      while (true) {
        logger.info(`📄 Parsing pagina ${currentPage} di Rentago...`);
        
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

      // Filtra offerte valide (Rentago non ha durata/anticipo quindi ignoriamo questi filtri)
      const validOffers = allOffers.filter(offer => {
        // Modifichiamo temporaneamente la validazione per Rentago
        const priceValid = offer.price >= config.scraping.minPrice && offer.price <= config.scraping.maxPrice;
        
        // Logica di validazione con priorità per brand/model
        let modelValid = true;
        let brandValid = true;
        
        if (config.scraping.includedModels.length > 0) {
          modelValid = config.scraping.includedModels.some(includedModel => 
            offer.model.toUpperCase().startsWith(includedModel)
          );
        } else {
          brandValid = config.scraping.excludedBrands.length === 0 || 
                       !config.scraping.excludedBrands.includes(offer.brand.toUpperCase());
          
          const modelExcludedValid = config.scraping.excludedModels.length === 0 || 
                                    !config.scraping.excludedModels.some(excludedModel => 
                                      offer.model.toUpperCase().startsWith(excludedModel)
                                    );
          
          modelValid = modelExcludedValid;
        }
        
        const isValid = priceValid && brandValid && modelValid;
        
        if (!isValid) {
          logger.debug('🚫 Offerta scartata dai filtri:', { 
            brand: offer.brand, 
            model: offer.model, 
            price: offer.price
          });
        }
        return isValid;
      });

      logger.info(`📊 Rentago parsing completato: ${totalOffers} offerte totali, ${validOffers.length} valide dopo filtri`);
      
      return validOffers.map(offer => ({
        ...offer,
        site: this.siteName
      }));
      
    } catch (error) {
      logger.error('❌ Errore durante il parsing delle offerte Rentago', { error: error.message });
      return [];
    }
  }

  async parseOffersFromCurrentPage(page) {
    try {
      const offers = [];
      
      // Selettori per le card delle offerte Rentago basati sull'HTML fornito
      const cardSelectors = [
        'a.auto-card',
        '.auto-card',
        'a[class*="auto-card"]',
        'a[href*="/noleggio-a-lungo-termine/veicolo/"]'
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
      
      // Brand e modello sono dentro .auto-card-desc
      const brandSelectors = [
        '.auto-card-desc .xs-text',
        '.auto-card-text .xs-text',
        'span.xs-text'
      ];

      const modelSelectors = [
        '.auto-card-desc strong',
        '.auto-card-text strong',
        'strong'
      ];

      // Prezzo è dentro la struttura con .orange-color
      const priceSelectors = [
        'strong.orange-color',
        '.orange-color.lg-text',
        '.auto-card-text strong.orange-color',
        'strong[class*="orange"]'
      ];

      // Estrai brand
      const brandElement = await this.findElementBySelectors(cardElement, brandSelectors);
      const brandText = brandElement ? this.cleanText(await brandElement.textContent()) : '';
      
      // Estrai modello
      const modelElement = await this.findElementBySelectors(cardElement, modelSelectors);
      const modelText = modelElement ? this.cleanText(await modelElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Brand: "${brandText}", Modello: "${modelText}"`);
      
      if (!brandText && !modelText) {
        logger.debug(`⚠️ Card ${cardIndex}: brand e modello non trovati`);
        return null;
      }

      // Se il brand non è trovato separatamente, prova a estrarlo dal modello
      let brand = brandText.toUpperCase();
      let model = modelText;
      
      if (!brand && modelText) {
        // Prova a separare brand dal modello (es: "Fiat Panda" -> brand="FIAT", model="Panda")
        const parts = modelText.split(' ');
        if (parts.length > 0) {
          brand = parts[0].toUpperCase();
          model = parts.slice(1).join(' ');
        }
      }
      
      // Se ancora non hai il brand, usa il primo testo trovato
      if (!brand) {
        brand = 'UNKNOWN';
      }

      // Estrai prezzo
      const priceElement = await this.findElementBySelectors(cardElement, priceSelectors);
      const priceText = priceElement ? this.cleanText(await priceElement.textContent()) : '';
      
      logger.debug(`🔍 Card ${cardIndex} - Prezzo raw: "${priceText}"`);
      
      const price = this.extractPrice(priceText);
      if (!price) {
        logger.debug(`⚠️ Card ${cardIndex}: prezzo non valido: "${priceText}"`);
        return null;
      }

      // Per Rentago, non abbiamo durata e anticipo nelle card
      const offer = {
        brand: brand,
        model: model || 'N/A',
        price: price,
        duration: null, // Non disponibile in Rentago
        anticipo: null, // Non disponibile in Rentago
        originalPrice: priceText,
        originalBrand: brandText,
        originalModel: modelText
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
      // Selettori specifici per la paginazione Rentago basati sull'HTML fornito
      // Il pulsante "Next" usa __doPostBack
      const nextButtonSelectors = [
        'a#content_hlNext',
        'a[id*="hlNext"]',
        'a:has-text("Next")',
        '.pagination a:has-text("Next")'
      ];

      for (const selector of nextButtonSelectors) {
        try {
          const nextButton = await page.$(selector);
          if (nextButton) {
            // Controlla se è disabilitato (ha classe aspNetDisabled)
            const buttonClass = await nextButton.getAttribute('class');
            if (buttonClass && buttonClass.includes('aspNetDisabled')) {
              logger.info('🏁 Pulsante "Next" disabilitato - siamo all\'ultima pagina');
              return false;
            }

            // Il pulsante è attivo, proviamo a cliccare
            logger.info(`🔄 Clic su pulsante "Next"...`);
            
            // Rentago usa __doPostBack, quindi dobbiamo cliccare e aspettare il reload
            await nextButton.click();
            
            // Aspetta che la pagina si ricarichi completamente
            await page.waitForTimeout(3000);
            
            // Verifica che sia cambiata pagina controllando se c'è un elemento attivo diverso
            const activePageElement = await page.$('.pagination .page-item.active a');
            if (activePageElement) {
              const activePageText = await activePageElement.textContent();
              logger.info(`🔄 Navigazione completata - ora siamo a pagina ${activePageText}`);
            }
            
            return true;
          }
        } catch (error) {
          logger.debug(`⚠️ Errore con selettore Next ${selector}:`, error.message);
        }
      }

      // Se non troviamo il pulsante Next, proviamo con i numeri di pagina
      // Cerchiamo il prossimo numero di pagina non attivo
      const pageNumbers = await page.$$('.pagination .page-item:not(.active) a.page-link');
      for (const pageLink of pageNumbers) {
        try {
          const pageText = await pageLink.textContent();
          const pageNum = parseInt(pageText);
          
          // Verifica che sia un numero e sia maggiore della pagina corrente
          if (!isNaN(pageNum)) {
            const currentPageElement = await page.$('.pagination .page-item.active a');
            if (currentPageElement) {
              const currentPageText = await currentPageElement.textContent();
              const currentPageNum = parseInt(currentPageText);
              
              if (pageNum === currentPageNum + 1) {
                logger.info(`🔄 Clic su pagina ${pageNum}...`);
                await pageLink.click();
                await page.waitForTimeout(3000);
                return true;
              }
            }
          }
        } catch (error) {
          // Continua con il prossimo link
        }
      }

      logger.info('🏁 Nessun pulsante "Next" o pagina successiva trovati - fine paginazione');
      return false;
      
    } catch (error) {
      logger.error('❌ Errore durante la navigazione alla pagina successiva:', error.message);
      return false;
    }
  }
}

module.exports = RentagoParser;