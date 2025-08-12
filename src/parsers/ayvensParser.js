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
        waitUntil: 'domcontentloaded', // Cambiato da networkidle - a volte CSS non carica
        timeout: 30000 
      });

      // Gestisce popup cookie prima di tutto
      await this.handleCookieConsent(page);
      
      // Attendiamo che il contenuto Angular si carichi
      await page.waitForTimeout(5000);
      
      // Prova ad applicare i filtri (non bloccante)
      await this.applyFilters(page);
      
      // Gestisci infinity scroll per caricare tutte le offerte
      await this.loadAllOffers(page);
      
      // Attesa finale per assicurare il caricamento delle card
      await page.waitForTimeout(2000);
      
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
        logger.info('⚠️ Nessun filtro web applicato - useremo il parsing per filtrare i risultati');
      }

    } catch (error) {
      logger.info('⚠️ Impossibile applicare filtri web su Ayvens - procedo senza filtri');
      logger.debug('Dettaglio errore filtri:', { error: error.message });
    }
  }

  async loadAllOffers(page) {
    try {
      logger.info('🔄 Caricamento di tutte le offerte con infinity scroll...');
      
      let previousCount = 0;
      let currentCount = 0;
      let attempts = 0;
      const maxAttempts = 20; // Massimo 20 tentativi di scroll
      
      do {
        previousCount = currentCount;
        
        // Conta le card attualmente visibili
        const cardCount = await page.$$eval('.product-box, div[class*="product-box"]', elements => elements.length).catch(() => 0);
        currentCount = cardCount;
        
        logger.info(`📊 Card caricate: ${currentCount} (tentativo ${attempts + 1}/${maxAttempts})`);
        
        // Scrolla fino in fondo alla pagina
        await page.evaluate(() => {
          window.scrollTo(0, document.body.scrollHeight);
        });
        
        // Attesa per il caricamento di nuove card
        await page.waitForTimeout(3000);
        
        // Cerca e clicca eventuali pulsanti "Carica altro" / "Load more"
        const loadMoreSelectors = [
          'button:has-text("Carica")',
          'button:has-text("Load")', 
          'button:has-text("Altri")',
          'button:has-text("More")',
          'button[class*="load"]',
          'button[class*="more"]',
          '.load-more button',
          '.btn-load-more'
        ];
        
        for (const selector of loadMoreSelectors) {
          try {
            const loadButton = await page.$(selector);
            if (loadButton) {
              const isVisible = await loadButton.isVisible();
              if (isVisible) {
                await loadButton.click();
                logger.info(`🔄 Cliccato pulsante "Carica altro": ${selector}`);
                await page.waitForTimeout(3000);
                break;
              }
            }
          } catch (error) {
            // Continua con il prossimo selettore
          }
        }
        
        attempts++;
        
      } while (currentCount > previousCount && attempts < maxAttempts);
      
      const finalCount = await page.$$eval('.product-box, div[class*="product-box"]', elements => elements.length).catch(() => 0);
      logger.info(`✅ Infinity scroll completato: ${finalCount} card totali caricate`);
      
      return finalCount;
      
    } catch (error) {
      logger.warn('⚠️ Errore durante il caricamento infinity scroll', { error: error.message });
      const fallbackCount = await page.$$eval('.product-box, div[class*="product-box"]', elements => elements.length).catch(() => 0);
      logger.info(`📊 Fallback: ${fallbackCount} card disponibili`);
      return fallbackCount;
    }
  }

  async parseOffers(page) {
    try {
      const offers = [];
      
      // Selettori specifici per Ayvens basati sull'HTML reale
      const offerSelectors = [
        '.product-box', // Selettore principale dalla card HTML
        'div[class*="product-box"]',
        'div[fxflex]', // Attributo Angular flex
        '.ng-star-inserted' // Classe Angular generica
      ];

      let offerElements = [];
      for (const selector of offerSelectors) {
        offerElements = await page.$$(selector);
        if (offerElements.length > 0) {
          logger.info(`✅ Trovati ${offerElements.length} elementi con selettore: ${selector}`);
          break;
        }
      }

      if (offerElements.length === 0) {
        logger.warn('⚠️ Nessuna card trovata con selettori specifici - provo selettori generici');
        
        // Selettori di fallback basati sulla struttura Angular
        const fallbackSelectors = [
          'div[class*="vetrina"]', // Dalla classe vetrina-dettagli
          'div[_ngcontent-serverapp-c133]', // Attributo Angular specifico
          'div[fxflex.xs]', // Attributi flex specifici
          'div[class*="STANDARD"]'
        ];
        
        for (const selector of fallbackSelectors) {
          offerElements = await page.$$(selector);
          if (offerElements.length > 3) {
            logger.info(`✅ Usando selettore di fallback: ${selector} (${offerElements.length} elementi)`);
            break;
          }
        }
      }

      if (offerElements.length === 0) {
        logger.error('❌ Nessuna card trovata su Ayvens - possibile problema di caricamento pagina');
        return offers;
      }

      const totalCards = offerElements.length;
      logger.info(`🔍 Analizzando ${totalCards} card totali trovate...`);

      let processedCount = 0;
      let validCount = 0;
      
      for (const element of offerElements) { // Processa TUTTE le card, non solo 50
        processedCount++;
        try {
          const offer = await this.extractOfferData(page, element);
          if (offer) {
            const isValid = this.isValidOffer(offer);
            if (isValid) {
              validCount++;
              offers.push({
                ...offer,
                site: this.siteName,
                url: page.url()
              });
              logger.info(`✅ Offerta valida trovata (${validCount}): ${offer.brand} ${offer.model} - €${offer.price}/mese`);
            } else {
              logger.debug(`❌ Offerta scartata (filtri): ${offer.brand} ${offer.model} - €${offer.price}/mese (durata: ${offer.duration} mesi)`, {
                price: offer.price,
                minPrice: config.scraping.minPrice,
                maxPrice: config.scraping.maxPrice,
                duration: offer.duration,
                minDuration: config.scraping.minDurationMonths,
                priceInRange: offer.price >= config.scraping.minPrice && offer.price <= config.scraping.maxPrice,
                durationValid: offer.duration >= config.scraping.minDurationMonths
              });
            }
          }
        } catch (error) {
          logger.debug(`Errore nell\'estrazione card ${processedCount}/${totalCards}`, { error: error.message });
        }
        
        // Progress ogni 50 card
        if (processedCount % 50 === 0) {
          logger.info(`📊 Progresso: ${processedCount}/${totalCards} card analizzate, ${validCount} valide finora`);
        }
      }

      logger.info(`🎯 Risultato finale: ${offers.length} offerte valide trovate su ${totalCards} totali (${Math.round((offers.length/totalCards)*100)}%)`);
      return offers;
    } catch (error) {
      logger.error('Errore durante il parsing delle offerte Ayvens', { error: error.message });
      return [];
    }
  }

  async extractOfferData(page, element) {
    try {
      // Selettori basati sull'HTML reale di Ayvens
      
      // Brand (dalla h3 con classe vetrina-titolo)
      let brand = '';
      const brandElement = await element.$('h3.vetrina-titolo a, .vetrina-titolo a');
      if (brandElement) {
        brand = await brandElement.textContent();
        brand = this.cleanText(brand);
        // Estrai solo la marca (prima parola)
        brand = brand.split(' ')[0];
      }

      // Modello completo (dalla p con classe vetrina-sottotitolo)
      let fullModel = '';
      const modelElement = await element.$('p.vetrina-sottotitolo, .vetrina-sottotitolo');
      if (modelElement) {
        fullModel = await modelElement.textContent();
        fullModel = this.cleanText(fullModel);
      }

      // Prezzo (dalla span con classe vetrina-prezzo)
      let priceText = '';
      const priceElement = await element.$('span.vetrina-prezzo, .vetrina-prezzo');
      if (priceElement) {
        priceText = await priceElement.textContent();
        priceText = this.cleanText(priceText);
      }

      // Durata e anticipo (dalla p con classe vetrina-info)
      let durationText = '';
      let anticipoText = '';
      const infoElement = await element.$('p.vetrina-info, .vetrina-info');
      if (infoElement) {
        const infoText = await infoElement.textContent();
        const cleanInfoText = this.cleanText(infoText);
        
        // Estrai durata (es: "48 Mesi")
        const durationMatch = cleanInfoText.match(/(\d+)\s*Mesi/i);
        if (durationMatch) {
          durationText = durationMatch[1] + ' mesi';
        }
        
        // Estrai anticipo (es: "Anticipo € 4.000")
        const anticipoMatch = cleanInfoText.match(/Anticipo\s*€\s*([\d.,]+)/i);
        if (anticipoMatch) {
          anticipoText = '€' + anticipoMatch[1];
        }
      }

      // Fallback: se non troviamo elementi specifici, usa il testo completo
      if (!brand && !priceText) {
        const fullText = await element.textContent();
        const cleanFullText = this.cleanText(fullText);
        
        // Pattern per prezzo
        const priceMatch = cleanFullText.match(/(\d+)€/);
        if (priceMatch) priceText = priceMatch[1] + '€';
        
        // Pattern per brand (prima parola maiuscola)
        const brandMatch = cleanFullText.match(/([A-Z][A-Za-z]+)/);
        if (brandMatch) brand = brandMatch[1];
      }

      // Parsing dei dati estratti
      const carBrand = brand ? brand.toUpperCase() : '';
      const price = this.extractPrice(priceText);
      const duration = this.extractDuration(durationText);
      const anticipo = anticipoText ? this.extractPrice(anticipoText) : null;

      // Debug logging con i dati trovati
      logger.debug('📋 Dati estratti da card Ayvens:', {
        brand: carBrand,
        fullModel,
        priceText: priceText,
        durationText: durationText,
        anticipoText: anticipoText,
        price: price,
        duration: duration,
        anticipo: anticipo,
        priceType: typeof priceText,
        durationType: typeof durationText,
        anticipoType: typeof anticipoText
      });

      // Validazione: deve avere almeno brand e prezzo
      if (!carBrand || !price || price <= 0) {
        logger.debug('❌ Card scartata: manca brand o prezzo valido', {
          hasCarBrand: !!carBrand,
          hasPrice: !!price,
          priceValue: price
        });
        return null;
      }

      logger.debug('✅ Card validata con successo');

      return {
        brand: carBrand,
        model: fullModel, // Modello completo come da sito
        price: price,
        duration: duration || 48,
        anticipo: anticipo || null, // Nuovo campo per anticipo
        originalPrice: priceText,
        originalModel: fullModel,
        originalDuration: durationText,
        originalAnticipo: anticipoText
      };
    } catch (error) {
      logger.debug('❌ Errore nell\'estrazione dati card Ayvens', { error: error.message });
      return null;
    }
  }
}

module.exports = AyvensParser;