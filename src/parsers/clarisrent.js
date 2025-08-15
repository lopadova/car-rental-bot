const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class ClarisRentParser extends BaseParser {
    constructor() {
        super('ClarisRent');
    }

    async navigateToOffers(page) {
        try {
            logger.info('Navigating to ClarisRent.it...');
            await page.goto('https://clarisrent.it/it/nlt-aziende', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            logger.info('Page loaded successfully');
            return true;
        } catch (error) {
            logger.info(`Error navigating to ClarisRent: ${error.message}`);
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
                    '.cookie-banner button',
                    '.privacy-button',
                    '.cookie-consent button',
                    '#cookie-notice-accept',
                    '.gdpr-accept'
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
            await page.waitForSelector('article.node-type-vehicle-simple', { timeout: 10000 });
            await page.waitForTimeout(3000); // Additional wait for dynamic content
            
            // Extract all offer cards
            logger.info('Extracting offer cards...');
            const offerCards = await page.$$eval('article.node-type-vehicle-simple', cards => {
                return cards.map(card => {
                    const data = {};
                    
                    // Extract brand
                    const brandElement = card.querySelector('.field--name-field-veh-brand .field--item');
                    if (brandElement) {
                        data.brand = brandElement.textContent.trim();
                    } else {
                        // Try alternative selector
                        const altBrandElement = card.querySelector('.field--name-field-veh-brand');
                        data.brand = altBrandElement ? altBrandElement.textContent.trim() : null;
                    }
                    
                    // Extract model
                    const modelElement = card.querySelector('.field--name-field-veh-model .field--item');
                    if (modelElement) {
                        data.model = modelElement.textContent.trim();
                    } else {
                        // Try alternative selector
                        const altModelElement = card.querySelector('.field--name-field-veh-model');
                        data.model = altModelElement ? altModelElement.textContent.trim() : null;
                    }
                    
                    // Extract price
                    const priceElement = card.querySelector('.price');
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim();
                        // Extract number from "405€"
                        const priceMatch = priceText.match(/(\d+)€/);
                        data.price = priceMatch ? priceMatch[1] : null;
                    }
                    
                    // Extract anticipo (deposit)
                    const anticipoElement = card.querySelector('.cardAnticipo');
                    if (anticipoElement) {
                        const anticipoText = anticipoElement.textContent.trim();
                        // Extract number from "Anticipo: 5.000€"
                        const anticipoMatch = anticipoText.match(/(\d+[\.,]?\d*)€/);
                        if (anticipoMatch) {
                            data.deposit = anticipoMatch[1].replace(/[.,]/g, '');
                        }
                    }
                    
                    // Extract durata (duration)
                    const durataElement = card.querySelector('.cardDurata');
                    if (durataElement) {
                        const durataText = durataElement.textContent.trim();
                        // Extract number from "48 mesi"
                        const durataMatch = durataText.match(/(\d+)\s*mesi/);
                        data.duration = durataMatch ? durataMatch[1] : null;
                    }
                    
                    // Extract kilometers
                    const infoItems = card.querySelectorAll('.infoItm');
                    infoItems.forEach(item => {
                        const value = item.querySelector('.value');
                        const info = item.querySelector('.info');
                        
                        if (value && info && info.textContent.trim().toLowerCase().includes('km')) {
                            const kmText = value.textContent.trim();
                            const kmMatch = kmText.match(/(\d+[\.,]?\d*)/);
                            if (kmMatch) {
                                data.kilometers = kmMatch[1].replace(/[.,]/g, '');
                            }
                        }
                    });
                    
                    // Extract fuel type
                    const fuelLabels = card.querySelectorAll('.info');
                    fuelLabels.forEach(label => {
                        const text = label.textContent.trim().toLowerCase();
                        if (text.includes('diesel') || text.includes('benzina') || text.includes('ibrido') || text.includes('elettrico')) {
                            data.fuel = label.textContent.trim();
                        }
                    });
                    
                    // Extract gear type
                    const gearLabels = card.querySelectorAll('.info');
                    gearLabels.forEach(label => {
                        const text = label.textContent.trim().toLowerCase();
                        if (text.includes('manuale') || text.includes('automatico') || text.includes('automatic')) {
                            data.gear = label.textContent.trim();
                        }
                    });
                    
                    // Extract image
                    const imgElement = card.querySelector('.field--name-field-veh-cover img');
                    if (imgElement && imgElement.src) {
                        // Make absolute URL if it's relative
                        if (imgElement.src.startsWith('/')) {
                            data.image = 'https://clarisrent.it' + imgElement.src;
                        } else {
                            data.image = imgElement.src;
                        }
                    }
                    
                    // Extract URL
                    const linkElement = card.querySelector('.cardAction a');
                    if (linkElement && linkElement.href) {
                        data.url = linkElement.href;
                    }
                    
                    return data;
                }).filter(data => data.brand && data.model && data.price); // Filter out invalid cards
            });
            
            logger.info(`Found ${offerCards.length} offer cards`);
            
            // Process and filter offers
            for (const cardData of offerCards) {
                try {
                    // Skip cards without essential data
                    if (!cardData.brand || !cardData.model || !cardData.price) {
                        logger.info(`Skipping card - missing essential data: brand=${cardData.brand}, model=${cardData.model}, price=${cardData.price}`);
                        continue;
                    }
                    
                    // Convert values to numbers
                    const price = parseInt(cardData.price);
                    const duration = parseInt(cardData.duration) || 48;
                    const deposit = parseInt(cardData.deposit) || 0;
                    const kilometers = parseInt(cardData.kilometers) || 0;
                    
                    // Create offer object
                    const offer = {
                        brand: cardData.brand.toUpperCase(),
                        model: cardData.model,
                        price: price,
                        duration: duration,
                        deposit: deposit,
                        kilometers: kilometers,
                        url: cardData.url || 'https://clarisrent.it/it/nlt-aziende',
                        image: cardData.image || null,
                        fuel: cardData.fuel || null,
                        gear: cardData.gear || null,
                        site: 'ClarisRent'
                    };
                    
                    // Apply config filters using BaseParser validation
                    if (this.isValidOffer(offer)) {
                        offers.push(offer);
                        logger.info(`Added offer: ${cardData.brand} ${cardData.model} - €${price}/month, ${duration} months, €${deposit} deposit, ${kilometers} km`);
                    } else {
                        logger.info(`Filtered out offer (doesn't meet config criteria): ${cardData.brand} ${cardData.model} - €${price}/month`);
                    }
                } catch (error) {
                    logger.info(`Error processing card data: ${error.message}`);
                }
            }
            
            logger.info(`Total offers extracted and filtered: ${offers.length}`);
            
        } catch (error) {
            logger.info(`Error parsing ClarisRent offers: ${error.message}`);
            logger.info(`Error stack: ${error.stack}`);
            throw error;
        }
        
        return offers;
    }
}

module.exports = ClarisRentParser;