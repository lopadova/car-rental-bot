const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class NoleggioSempliceParser extends BaseParser {
    constructor() {
        super('NoleggioSemplice');
    }

    async navigateToOffers(page) {
        try {
            logger.info('Navigating to NoleggioSemplice...');
            await page.goto('https://www.noleggiosemplice.it/noleggio-lungo-termine', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            logger.info('Page loaded successfully');
            return true;
        } catch (error) {
            logger.info(`Error navigating to NoleggioSemplice: ${error.message}`);
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
                    'button[class*="cookie"]:has-text("Accetta")'
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
            await page.waitForSelector('.mui-1pkwe74', { timeout: 10000 });
            await page.waitForTimeout(2000); // Additional wait for dynamic content
            
            // Extract all offer cards
            logger.info('Extracting offer cards...');
            const offerCards = await page.$$eval('a[href^="/noleggio-lungo-termine/"] > .mui-1pkwe74', cards => {
                return cards.map(card => {
                    const data = {};
                    
                    // Extract title (brand and model)
                    const titleElement = card.querySelector('h4.mui-1aovnq');
                    if (titleElement) {
                        data.fullTitle = titleElement.textContent.trim();
                    }
                    
                    // Extract price
                    const priceElement = card.querySelector('.mui-1n6qp5m');
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim();
                        // Extract just the number from "€169/ mese i. e."
                        const priceMatch = priceText.match(/€(\d+)/);
                        data.price = priceMatch ? priceMatch[1] : null;
                    }
                    
                    // Extract details from the info sections
                    const infoSections = card.querySelectorAll('.mui-n7hha6');
                    infoSections.forEach(section => {
                        const label = section.querySelector('.mui-1snrwty');
                        const value = section.querySelector('.mui-1r8sz5o');
                        
                        if (label && value) {
                            const labelText = label.textContent.trim().toLowerCase();
                            const valueText = value.textContent.trim();
                            
                            if (labelText.includes('anticipo')) {
                                // Extract deposit amount
                                const depositMatch = valueText.match(/€(\d+)/);
                                data.deposit = depositMatch ? depositMatch[1] : valueText;
                            } else if (labelText.includes('durata')) {
                                // Extract duration
                                const durationMatch = valueText.match(/(\d+)/);
                                data.duration = durationMatch ? durationMatch[1] : null;
                            } else if (labelText.includes('km')) {
                                // Extract kilometers
                                const kmMatch = valueText.match(/(\d+)/);
                                data.kilometers = kmMatch ? kmMatch[1] : null;
                            }
                        }
                    });
                    
                    // Extract image
                    const imgElement = card.querySelector('.ImageContainer_img__c0FW3[alt]');
                    if (imgElement && imgElement.src && !imgElement.src.includes('banner')) {
                        data.image = imgElement.src;
                    }
                    
                    // Extract offer type (hybrid, electric, etc.)
                    const tagElement = card.querySelector('.OfferTag_fixed_top_left__rWkwC span');
                    if (tagElement) {
                        data.offerType = tagElement.textContent.trim();
                    }
                    
                    return data;
                }).filter(data => data.fullTitle && data.price); // Filter out invalid cards
            });
            
            logger.info(`Found ${offerCards.length} offer cards`);
            
            // Process and filter offers
            for (const cardData of offerCards) {
                try {
                    // Parse brand and model from full title
                    const titleParts = cardData.fullTitle.split(' ');
                    const brand = titleParts[0];
                    const model = titleParts.slice(1).join(' ');
                    
                    // Convert price to number
                    const price = parseInt(cardData.price);
                    const duration = parseInt(cardData.duration) || 36;
                    const deposit = parseInt(cardData.deposit) || 0;
                    const kilometers = parseInt(cardData.kilometers) || 0;
                    
                    // Create offer object
                    const offer = {
                        brand: brand,
                        model: model,
                        price: price,
                        duration: duration,
                        deposit: deposit,
                        kilometers: kilometers,
                        url: 'https://www.noleggiosemplice.it/noleggio-lungo-termine',
                        image: cardData.image || null,
                        offerType: cardData.offerType || null,
                        site: 'NoleggioSemplice'
                    };
                    
                    // Apply config filters using BaseParser validation
                    if (this.isValidOffer(offer)) {
                        offers.push(offer);
                        logger.info(`Added offer: ${brand} ${model} - €${price}/month, ${duration} months, €${deposit} deposit, ${kilometers} km`);
                    } else {
                        logger.info(`Filtered out offer (doesn't meet config criteria): ${brand} ${model} - €${price}/month`);
                    }
                } catch (error) {
                    logger.info(`Error processing card data: ${error.message}`);
                }
            }
            
            logger.info(`Total offers extracted and filtered: ${offers.length}`);
            
        } catch (error) {
            logger.info(`Error parsing NoleggioSemplice offers: ${error.message}`);
            logger.info(`Error stack: ${error.stack}`);
            throw error;
        }
        
        return offers;
    }
}

module.exports = NoleggioSempliceParser;