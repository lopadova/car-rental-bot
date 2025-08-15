const BaseParser = require('./baseParser');
const logger = require('../utils/logger');

class NoleggiareParser extends BaseParser {
    constructor() {
        super('Noleggiare');
    }

    async navigateToOffers(page) {
        try {
            logger.info('Navigating to Noleggiare.it...');
            await page.goto('https://www.noleggiare.it/it/noleggio-lungo-termine/auto-nuove/', { 
                waitUntil: 'domcontentloaded',
                timeout: 30000 
            });
            
            logger.info('Page loaded successfully');
            return true;
        } catch (error) {
            logger.info(`Error navigating to Noleggiare: ${error.message}`);
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
                    '.cookie-consent button'
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
            await page.waitForSelector('.vehicle-card', { timeout: 10000 });
            await page.waitForTimeout(3000); // Additional wait for dynamic content
            
            // Extract all offer cards
            logger.info('Extracting offer cards...');
            const offerCards = await page.$$eval('.vehicle-card', cards => {
                return cards.map(card => {
                    const data = {};
                    
                    // Extract title (brand and model)
                    const titleElement = card.querySelector('.vehicle-card__title');
                    if (titleElement) {
                        // Get all text content from title element
                        const fullText = titleElement.textContent.trim();
                        
                        // Version/details in small tag
                        const smallElement = titleElement.querySelector('small');
                        let versionText = '';
                        if (smallElement) {
                            versionText = smallElement.textContent.trim();
                            data.version = versionText;
                        }
                        
                        // Main title is full text minus small text
                        if (versionText) {
                            data.fullTitle = fullText.replace(versionText, '').trim();
                        } else {
                            data.fullTitle = fullText;
                        }
                    }
                    
                    // Extract price from button
                    const priceElement = card.querySelector('.button--rate span');
                    if (priceElement) {
                        const priceText = priceElement.textContent.trim();
                        // Extract number from "€ 159"
                        const priceMatch = priceText.match(/€\s*(\d+)/);
                        data.price = priceMatch ? priceMatch[1] : null;
                    }
                    
                    // Extract details from vehicle-card__details
                    const detailElements = card.querySelectorAll('.vehicle-card__details p');
                    detailElements.forEach(detail => {
                        const text = detail.textContent.trim();
                        const spanElement = detail.querySelector('span');
                        
                        if (text.includes('Anticipo') && spanElement) {
                            // Extract deposit amount from span
                            const depositText = spanElement.textContent.trim();
                            const depositMatch = depositText.match(/€\s*(\d+)/);
                            data.deposit = depositMatch ? depositMatch[1] : null;
                        } else if (text.includes('Durata') && spanElement) {
                            // Extract duration from span
                            const durationText = spanElement.textContent.trim();
                            const durationMatch = durationText.match(/(\d+)\s*mesi/);
                            data.duration = durationMatch ? durationMatch[1] : null;
                        } else if (text.includes('Km') && spanElement) {
                            // Extract kilometers from span
                            const kmText = spanElement.textContent.trim();
                            const kmMatch = kmText.match(/(\d+)\s*Km/);
                            data.kilometers = kmMatch ? kmMatch[1] : null;
                        }
                    });
                    
                    // Extract image from background-image style
                    const imageElement = card.querySelector('.vehicle-card__image');
                    if (imageElement) {
                        const style = imageElement.getAttribute('style');
                        if (style) {
                            const urlMatch = style.match(/url\(&quot;([^&]+)&quot;\)/);
                            if (urlMatch) {
                                data.image = urlMatch[1];
                            }
                        }
                    }
                    
                    return data;
                }).filter(data => data.fullTitle && data.price); // Filter out invalid cards
            });
            
            logger.info(`Found ${offerCards.length} offer cards`);
            
            // Process and filter offers
            for (const cardData of offerCards) {
                try {
                    // Parse brand and model from full title
                    let brand = '';
                    let model = '';
                    
                    // For FIAT PANDA format, split by space
                    const titleParts = cardData.fullTitle.trim().split(' ');
                    
                    // Common brand names to identify
                    const knownBrands = ['FIAT', 'TOYOTA', 'VOLKSWAGEN', 'FORD', 'RENAULT', 'PEUGEOT', 
                                       'CITROEN', 'CITROËN', 'OPEL', 'BMW', 'MERCEDES', 'AUDI', 'NISSAN', 
                                       'MAZDA', 'HYUNDAI', 'KIA', 'SUZUKI', 'SKODA', 'SEAT', 
                                       'JEEP', 'ALFA', 'LANCIA', 'DACIA', 'SMART', 'MINI', 'MG'];
                    
                    // Try to find brand at the beginning
                    if (titleParts.length >= 2) {
                        const firstWord = titleParts[0].toUpperCase();
                        const secondWord = titleParts[1].toUpperCase();
                        
                        // Check if first word is a known brand
                        if (knownBrands.includes(firstWord)) {
                            brand = firstWord;
                            model = titleParts.slice(1).join(' ');
                        } 
                        // Check for two-word brands like "ALFA ROMEO"
                        else if (firstWord === 'ALFA' && secondWord === 'ROMEO') {
                            brand = 'ALFA ROMEO';
                            model = titleParts.slice(2).join(' ');
                        }
                        // Default: first word as brand
                        else {
                            brand = firstWord;
                            model = titleParts.slice(1).join(' ');
                        }
                    } else if (titleParts.length === 1) {
                        // If only one word, assume it's the model
                        brand = 'UNKNOWN';
                        model = titleParts[0];
                    }
                    
                    // Convert values to numbers
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
                        url: 'https://www.noleggiare.it/it/noleggio-lungo-termine/auto-nuove/',
                        image: cardData.image || null,
                        version: cardData.version || null,
                        site: 'Noleggiare'
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
            logger.info(`Error parsing Noleggiare offers: ${error.message}`);
            logger.info(`Error stack: ${error.stack}`);
            throw error;
        }
        
        return offers;
    }
}

module.exports = NoleggiareParser;