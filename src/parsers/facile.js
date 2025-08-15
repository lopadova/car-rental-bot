const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class FacileParser extends BaseParser {
    constructor() {
        super('Facile');
    }

    async navigateToOffers(page) {
        try {
            logger.info('Navigating to Facile.it...');
            await page.goto('https://www.facile.it/noleggio-lungo-termine-partita-iva.html?sort=monthlyFee', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            logger.info('Page loaded successfully');
            return true;
        } catch (error) {
            logger.info(`Error navigating to Facile: ${error.message}`);
            return false;
        }
    }

    async parseOffers(page) {
        const offers = [];
        
        try {
            logger.info('Starting to parse offers, handling cookie consent...');
            
            // Handle cookie consent
            try {
                const cookieSelectors = [
                    'button[aria-label*="accetta"]',
                    'button[class*="accept"]',
                    'button:has-text("Accetta")',
                    '#onetrust-accept-btn-handler',
                    '.cookie-accept',
                    'button[id*="accept"]',
                    'button[class*="cookie"]:has-text("Accetta")',
                    'button[class*="consent"]',
                    'a[class*="accept"]',
                    'button[class*="cookie-agree"]',
                    '#cookie-accept',
                    '.cookie-banner button'
                ];
                
                for (const selector of cookieSelectors) {
                    try {
                        const cookieButton = await page.$(selector);
                        if (cookieButton) {
                            logger.info(`Found cookie button with selector: ${selector}`);
                            await cookieButton.click();
                            await page.waitForTimeout(1000);
                            logger.info('Cookie consent accepted');
                            break;
                        }
                    } catch (e) {
                        // Continue trying other selectors
                    }
                }
            } catch (error) {
                logger.info('No cookie consent needed or already accepted');
            }
            
            // Wait for offers to load
            logger.info('Waiting for offers to load...');
            await page.waitForSelector('div[data-i="CardContainer"]', { timeout: 10000 });
            await page.waitForTimeout(3000); // Additional wait for dynamic content
            
            // Extract all offer cards
            logger.info('Extracting offer cards...');
            const offerCards = await page.$$eval('div[data-i="CardContainer"]', cards => {
                return cards.map(card => {
                    const data = {};
                    
                    // Extract data from card attributes
                    data.deposit = card.getAttribute('data-deposit');
                    data.fuel = card.getAttribute('data-fuel');
                    data.segment = card.getAttribute('data-segment');
                    data.gear = card.getAttribute('data-gear');
                    data.used = card.getAttribute('data-used');
                    
                    // Extract brand and model - look for specific selector patterns
                    let titleElement = null;
                    
                    // Try different selectors for the main title
                    const titleSelectors = [
                        'span._84psk6qr._84psk6oj._84psk63v._84psk6z._84psk61v._84psk6en', // More specific selector
                        'span[class*="_84psk6qr"][class*="_84psk6oj"]', // Alternative
                        '.ImageContainer_img__c0FW3 + div span:first-child', // After image
                        'img[alt*="Noleggio lungo termine"] + div span:first-child' // Near image alt
                    ];
                    
                    for (const selector of titleSelectors) {
                        titleElement = card.querySelector(selector);
                        if (titleElement && titleElement.textContent.trim()) {
                            const text = titleElement.textContent.trim();
                            // Make sure it's not a tag like "Usato", "Consegna veloce", etc.
                            if (!text.match(/^(Usato|Consegna|1 canone|Anticipo|Durata|€|\d+)/i)) {
                                data.fullTitle = text;
                                break;
                            }
                        }
                    }
                    
                    // Fallback: if no specific selector worked, search all spans but be more selective
                    if (!data.fullTitle) {
                        const titleSpans = card.querySelectorAll('span');
                        for (const span of titleSpans) {
                            const text = span.textContent.trim();
                            // Look for spans that look like car names (Brand Model format)
                            if (text && 
                                text.match(/^[A-Z][a-z]+ [A-Z]/i) && // Pattern like "Jeep Compass", "Toyota Aygo"
                                !text.includes('€') && 
                                !text.includes('Anticipo') && 
                                !text.includes('Durata') &&
                                !text.match(/^(Usato|Consegna|1 canone|al mese|IVA|omaggio)/i)) {
                                data.fullTitle = text;
                                break;
                            }
                        }
                    }
                    
                    // Extract price (from TextZoomer element)
                    const priceElement = card.querySelector('[data-i="TextZoomer"]');
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim();
                        const priceMatch = priceText.match(/(\d+)€/);
                        data.price = priceMatch ? priceMatch[1] : null;
                    }
                    
                    // Extract details from list items
                    const listItems = card.querySelectorAll('li span span');
                    listItems.forEach(item => {
                        const text = item.textContent.trim();
                        
                        if (text.includes('Anticipo')) {
                            // Extract deposit if not already from attribute
                            if (!data.deposit) {
                                const depositMatch = text.match(/(\d+\.?\d*)€/);
                                data.deposit = depositMatch ? depositMatch[1].replace('.', '') : null;
                            }
                        } else if (text.includes('Durata')) {
                            // Extract duration
                            const durationMatch = text.match(/(\d+)\s*mesi/);
                            data.duration = durationMatch ? durationMatch[1] : null;
                        } else if (text.includes('km')) {
                            // Extract kilometers
                            const kmMatch = text.match(/([\d.]+)km/);
                            data.kilometers = kmMatch ? kmMatch[1].replace('.', '') : null;
                        }
                    });
                    
                    // Extract image
                    const imgElement = card.querySelector('img');
                    if (imgElement && imgElement.src) {
                        data.image = imgElement.src;
                    }
                    
                    // Extract URL from link
                    const linkElement = card.querySelector('a[href*="/noleggio-lungo-termine/"]');
                    if (linkElement) {
                        data.url = 'https://www.facile.it' + linkElement.getAttribute('href');
                    }
                    
                    // Check for promotional offers
                    const promoElement = card.querySelector('div._84psk6ob._84psk643._84psk61a._84psk6z._84psk6v._84psk6br');
                    if (promoElement) {
                        const promoText = promoElement.textContent.trim();
                        if (promoText.includes('PROMO DEL MESE')) {
                            data.promo = 'promo_del_mese';
                        } else if (promoText.includes('Offerta esclusiva Facile.it')) {
                            data.promo = 'offerta_esclusiva';
                        }
                    }
                    
                    return data;
                }).filter(data => data.fullTitle && data.price); // Filter out invalid cards
            });
            
            logger.info(`Found ${offerCards.length} offer cards`);
            
            // Process and filter offers
            for (const cardData of offerCards) {
                try {
                    // Filter out invalid titles that might be tags or promotional text
                    const invalidTitles = ['USATO', 'CONSEGNA', 'VELOCE', '1', 'CANONE', 'OMAGGIO', 'AL', 'MESE', 'IVA'];
                    let isValidTitle = true;
                    
                    if (!cardData.fullTitle) {
                        isValidTitle = false;
                    } else {
                        const titleUpper = cardData.fullTitle.toUpperCase();
                        for (const invalid of invalidTitles) {
                            if (titleUpper.startsWith(invalid)) {
                                isValidTitle = false;
                                break;
                            }
                        }
                    }
                    
                    if (!isValidTitle) {
                        logger.info(`Skipping invalid title: ${cardData.fullTitle}`);
                        continue; // Skip this card
                    }
                    
                    // Parse brand and model from full title
                    const titleParts = cardData.fullTitle.split(' ');
                    let brand = '';
                    let model = '';
                    
                    // Common brand names to identify (order by length for multi-word brands first)
                    const knownBrands = ['ALFA ROMEO', 'LAND ROVER', 'MERCEDES-BENZ', 'TOYOTA', 'FIAT', 
                                       'VOLKSWAGEN', 'FORD', 'RENAULT', 'PEUGEOT', 'CITROEN', 'OPEL', 
                                       'BMW', 'MERCEDES', 'AUDI', 'NISSAN', 'MAZDA', 'HYUNDAI', 'KIA', 
                                       'SUZUKI', 'SKODA', 'SEAT', 'JEEP', 'ALFA', 'LANCIA', 'DACIA', 
                                       'SMART', 'MINI', 'MG'];
                    
                    // Find brand in title
                    const titleUpper = cardData.fullTitle.toUpperCase();
                    for (const knownBrand of knownBrands) {
                        if (titleUpper.startsWith(knownBrand)) {
                            brand = knownBrand;
                            // Model is everything after the brand (use original text)
                            model = cardData.fullTitle.substring(knownBrand.length).trim();
                            break;
                        }
                    }
                    
                    // If no known brand found, assume first word is brand (but validate it's not an invalid word)
                    if (!brand && titleParts.length > 0) {
                        const firstWordUpper = titleParts[0].toUpperCase();
                        if (!invalidTitles.includes(firstWordUpper)) {
                            brand = titleParts[0].toUpperCase();
                            model = titleParts.slice(1).join(' ');
                        }
                    }
                    
                    // Skip if we couldn't extract a valid brand
                    if (!brand) {
                        logger.info(`Skipping card - no valid brand found in title: ${cardData.fullTitle}`);
                        continue;
                    }
                    
                    // Convert values to numbers
                    const price = parseInt(cardData.price);
                    const duration = parseInt(cardData.duration) || 36;
                    const deposit = parseInt(cardData.deposit) || 0;
                    const kilometers = parseInt(cardData.kilometers) || 0;
                    
                    // Create offer object
                    const offer = {
                        brand: brand.toUpperCase(),
                        model: model,
                        price: price,
                        duration: duration,
                        deposit: deposit,
                        kilometers: kilometers,
                        url: cardData.url || 'https://www.facile.it/noleggio-lungo-termine-partita-iva.html',
                        image: cardData.image || null,
                        fuel: cardData.fuel || null,
                        gear: cardData.gear || null,
                        site: 'Facile',
                        promo: cardData.promo || null
                    };
                    
                    // Apply config filters using BaseParser validation
                    if (this.isValidOffer(offer)) {
                        offers.push(offer);
                        const promoText = cardData.promo ? ` [${cardData.promo.toUpperCase()}]` : '';
                        logger.info(`Added offer: ${brand} ${model} - €${price}/month, ${duration} months, €${deposit} deposit, ${kilometers} km${promoText}`);
                    } else {
                        logger.info(`Filtered out offer (doesn't meet config criteria): ${brand} ${model} - €${price}/month`);
                    }
                } catch (error) {
                    logger.info(`Error processing card data: ${error.message}`);
                }
            }
            
            logger.info(`Total offers extracted and filtered: ${offers.length}`);
            
        } catch (error) {
            logger.info(`Error parsing Facile offers: ${error.message}`);
            logger.info(`Error stack: ${error.stack}`);
            throw error;
        }
        
        return offers;
    }
}

module.exports = FacileParser;