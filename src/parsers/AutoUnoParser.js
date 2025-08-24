const BaseParser = require('./BaseParser');
const logger = require('../utils/logger');

class AutoUnoParser extends BaseParser {
    constructor() {
        super('AutoUno');
    }

    async navigateToOffers(page) {
        logger.info('Navigazione verso AutoUno...');
        const url = 'https://www.gruppoautouno.it/noleggio-a-lungo-termine/offerte-noleggio-aziende-e-p-iva/';
        
        try {
            await page.goto(url, { 
                waitUntil: 'networkidle', 
                timeout: 60000 
            });
            
            logger.info('Pagina AutoUno caricata con successo');
            
            // Piccola pausa per assicurarsi che tutto sia caricato
            await page.waitForTimeout(2000);
            
            return true;
        } catch (error) {
            logger.error(`Errore durante la navigazione: ${error.message}`);
            throw error;
        }
    }

    async parseOffers(page) {
        logger.info('Inizio parsing offerte AutoUno');
        const offers = [];
        let allOfferCards = [];
        let pageNumber = 1;

        try {
            // Accetta i cookie se necessario
            await this.handleCookieConsent(page);

            // Attendi che le card delle offerte siano caricate
            logger.debug('Attendo il caricamento delle card offerte...');
            await page.waitForSelector('.rental-offer-teaser', { 
                timeout: 30000,
                visible: true 
            });

            // Loop per caricare tutte le pagine
            while (true) {
                logger.info(`Parsing pagina ${pageNumber}...`);
                
                // Piccola pausa per assicurarsi che tutto sia caricato
                await page.waitForTimeout(2000);

                // Conta le card prima del caricamento per identificare le nuove
                const cardCountBefore = allOfferCards.length;

                // Estrai tutte le card delle offerte presenti nella pagina corrente
                logger.debug(`Estrazione card offerte dalla pagina ${pageNumber}...`);
                const allCurrentCards = await page.$$eval('.rental-offer-teaser', cards => {
                return cards.map(card => {
                    try {
                        // Estrai marca e modello
                        const nameElement = card.querySelector('.name');
                        let brand = '';
                        let model = '';
                        
                        if (nameElement) {
                            const nameText = nameElement.textContent.trim();
                            const strongElement = nameElement.querySelector('strong');
                            
                            if (strongElement) {
                                model = strongElement.textContent.trim();
                                // La marca è il testo prima del strong
                                brand = nameText.replace(model, '').trim();
                            }
                        }

                        // Estrai versione
                        const versionElement = card.querySelector('.version');
                        const version = versionElement ? versionElement.textContent.trim() : '';

                        // Combina modello e versione per il modello completo
                        const fullModel = version ? `${model} ${version}` : model;

                        // Estrai prezzo
                        const priceElement = card.querySelector('.price strong');
                        let price = '';
                        if (priceElement) {
                            const priceText = priceElement.textContent.trim();
                            // Estrai solo il numero del prezzo
                            const priceMatch = priceText.match(/€\s*(\d+(?:\.\d+)?)/);
                            price = priceMatch ? priceMatch[1] : '';
                        }

                        // Estrai dettagli (durata, km, anticipo)
                        const detailsElement = card.querySelector('.details');
                        let duration = '';
                        let mileage = '';
                        let downPayment = '';
                        
                        if (detailsElement) {
                            const detailsText = detailsElement.textContent.trim();
                            
                            // Estrai durata (es. "24 mesi")
                            const durationMatch = detailsText.match(/(\d+)\s*mesi/i);
                            if (durationMatch) {
                                duration = durationMatch[1];
                            }
                            
                            // Estrai chilometraggio (es. "10.000 km/anno")
                            const mileageMatch = detailsText.match(/([\d.]+)\s*km/i);
                            if (mileageMatch) {
                                mileage = mileageMatch[1].replace('.', '');
                            }
                            
                            // Estrai anticipo (es. "Anticipo € 4.500")
                            const downPaymentMatch = detailsText.match(/Anticipo\s*€\s*([\d.]+)/i);
                            if (downPaymentMatch) {
                                downPayment = downPaymentMatch[1].replace('.', '');
                            }
                        }

                        // Estrai URL dettaglio
                        const linkElement = card.querySelector('a.to-modal, .actions a');
                        const detailUrl = linkElement ? linkElement.href : '';

                        // Estrai URL immagine
                        const imageElement = card.querySelector('.imagin-image img');
                        const imageUrl = imageElement ? imageElement.src : '';

                        return {
                            brand,
                            model: fullModel,
                            price,
                            duration,
                            mileage,
                            downPayment,
                            detailUrl,
                            imageUrl,
                            raw: {
                                nameText: nameElement ? nameElement.textContent.trim() : '',
                                versionText: version,
                                priceText: priceElement ? priceElement.textContent.trim() : '',
                                detailsText: detailsElement ? detailsElement.textContent.trim() : ''
                            }
                        };
                    } catch (error) {
                        console.error('Errore nel parsing della card:', error);
                        return null;
                    }
                });
            });

                // Per la prima pagina, aggiungi tutte le card
                // Per le pagine successive, aggiungi solo le nuove card
                let newCards = [];
                if (pageNumber === 1) {
                    newCards = allCurrentCards;
                    allOfferCards = allCurrentCards;
                } else {
                    // Prende solo le nuove card (quelle aggiunte dopo il click)
                    newCards = allCurrentCards.slice(cardCountBefore);
                    allOfferCards = allCurrentCards; // Aggiorna con tutte le card presenti
                }
                
                logger.info(`Trovate ${newCards.length} nuove card nella pagina ${pageNumber}, totale: ${allCurrentCards.length}`);

                // Cerca il pulsante per caricare altri modelli
                const loadMoreButton = await page.$('.pagination-button a.button');
                
                if (loadMoreButton) {
                    const buttonText = await page.$eval('.pagination-button a.button', el => el.textContent.trim());
                    const buttonHref = await page.$eval('.pagination-button a.button', el => el.href);
                    
                    logger.info(`Trovato pulsante paginazione: "${buttonText}" -> ${buttonHref}`);
                    
                    // Clicca il pulsante per caricare altre offerte
                    await loadMoreButton.click();
                    pageNumber++;
                    
                    // Attendi che le nuove card siano caricate
                    await page.waitForTimeout(3000);
                    
                    // Attendi che almeno una nuova card sia visibile
                    try {
                        await page.waitForSelector('.rental-offer-teaser', { 
                            timeout: 10000,
                            visible: true 
                        });
                    } catch (error) {
                        logger.warn('Timeout in attesa di nuove card, potrebbe essere l\'ultima pagina');
                        break;
                    }
                } else {
                    logger.info(`Nessun pulsante 'Carica altri modelli' trovato, ultima pagina raggiunta`);
                    break;
                }
            }

            logger.info(`Parsing completato: ${allOfferCards.length} card totali trovate in ${pageNumber} pagine`);

            // Filtra le offerte nulle e processa ogni offerta
            for (const cardData of allOfferCards) {
                if (!cardData) continue;

                logger.debug(`Processing offerta: ${cardData.brand} ${cardData.model}`);
                logger.debug(`  - Prezzo: €${cardData.price}/mese`);
                logger.debug(`  - Durata: ${cardData.duration} mesi`);
                logger.debug(`  - Chilometraggio: ${cardData.mileage} km/anno`);
                logger.debug(`  - Anticipo: €${cardData.downPayment}`);

                // Valida i dati essenziali
                if (!cardData.brand || !cardData.model || !cardData.price) {
                    logger.warn(`Offerta incompleta, salto: ${JSON.stringify(cardData.raw)}`);
                    continue;
                }

                // Crea l'oggetto offerta
                const offer = {
                    site: 'AutoUno',
                    brand: cardData.brand,
                    model: cardData.model,
                    version: cardData.model, // Già include la versione
                    price: parseFloat(cardData.price) || 0,
                    duration: parseInt(cardData.duration) || 0,
                    monthly_price: parseFloat(cardData.price) || 0,
                    duration_months: parseInt(cardData.duration) || 0,
                    yearly_km: parseInt(cardData.mileage) || 0,
                    down_payment: parseFloat(cardData.downPayment) || 0,
                    url: cardData.detailUrl || '',
                    image_url: cardData.imageUrl || '',
                    extraction_date: new Date().toISOString()
                };

                // Applica i filtri configurati
                const isValid = this.isValidOffer(offer);
                
                
                if (isValid) {
                    offers.push(offer);
                    logger.info(`✓ Offerta aggiunta: ${offer.brand} ${offer.model} - €${offer.monthly_price}/mese`);
                } else {
                    logger.debug(`✗ Offerta filtrata: ${offer.brand} ${offer.model} - €${offer.monthly_price}/mese`);
                }
            }

            logger.info(`Parsing completato. ${offers.length} offerte valide estratte e filtrate da ${allOfferCards.length} card totali`);
            return offers;

        } catch (error) {
            logger.error(`Errore durante il parsing: ${error.message}`);
            logger.debug(`Stack trace: ${error.stack}`);
            
            // Prova a fare uno screenshot per debug
            try {
                const screenshotPath = `./screenshots/autouno_error_${Date.now()}.png`;
                await page.screenshot({ path: screenshotPath, fullPage: true });
                logger.debug(`Screenshot salvato in: ${screenshotPath}`);
            } catch (screenshotError) {
                logger.warn(`Impossibile salvare screenshot: ${screenshotError.message}`);
            }
            
            return offers;
        }
    }

    async handleCookieConsent(page) {
        try {
            logger.debug('Verifico presenza banner cookie...');
            
            // Prova diversi selettori comuni per i pulsanti di accettazione cookie
            const cookieSelectors = [
                '#onetrust-accept-btn-handler',
                '.cookie-accept',
                '.accept-cookies',
                '[id*="accept"]',
                '[class*="accept"]',
                'button:has-text("Accetta")',
                'button:has-text("Accept")',
                'a:has-text("Accetta")',
                '.onetrust-close-btn-handler',
                '#accept-recommended-btn-handler'
            ];

            for (const selector of cookieSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        const isVisible = await button.isVisible().catch(() => false);
                        if (isVisible) {
                            logger.debug(`Trovato pulsante cookie con selettore: ${selector}`);
                            await button.click();
                            logger.info('Cookie accettati');
                            await page.waitForTimeout(1000);
                            return;
                        }
                    }
                } catch (err) {
                    // Continua con il prossimo selettore
                }
            }

            // Se non trova nessun pulsante specifico, prova con un approccio più generale
            const acceptButton = await page.evaluate(() => {
                const buttons = Array.from(document.querySelectorAll('button, a'));
                const acceptBtn = buttons.find(btn => {
                    const text = btn.textContent.toLowerCase();
                    return text.includes('accetta') || text.includes('accept') || text.includes('ok');
                });
                if (acceptBtn) {
                    acceptBtn.click();
                    return true;
                }
                return false;
            });

            if (acceptButton) {
                logger.info('Cookie accettati tramite ricerca generica');
                await page.waitForTimeout(1000);
            } else {
                logger.debug('Nessun banner cookie trovato o già accettato');
            }

        } catch (error) {
            logger.warn(`Errore nella gestione dei cookie: ${error.message}`);
        }
    }
}

module.exports = AutoUnoParser;