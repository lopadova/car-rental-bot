const axios = require('axios');
const config = require('../config');
const logger = require('./logger');

class DiscordNotifier {
  constructor() {
    this.webhookUrl = config.discord.webhookUrl;
  }

  async sendOffers(bestOffers) {
    try {
      if (!this.webhookUrl || this.webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
        logger.error('URL webhook Discord non configurato');
        return false;
      }

      const messages = this.formatMultipleMessages(bestOffers);
      
      logger.info(`📨 Invio di ${messages.length} messaggi Discord...`);
      
      let successCount = 0;
      for (let i = 0; i < messages.length; i++) {
        const payload = {
          content: null,
          embeds: [messages[i]],
          username: 'Car Rental Bot',
          avatar_url: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png'
        };

        try {
          const response = await axios.post(this.webhookUrl, payload);
          
          if (response.status === 204) {
            successCount++;
            logger.info(`✅ Messaggio ${i + 1}/${messages.length} inviato con successo`);
          } else {
            logger.error(`❌ Errore messaggio ${i + 1}/${messages.length}`, { status: response.status });
          }
          
          // Attesa tra messaggi per evitare rate limiting
          if (i < messages.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
          
        } catch (messageError) {
          logger.error(`❌ Errore durante l'invio del messaggio ${i + 1}/${messages.length}`, { 
            error: messageError.message,
            status: messageError.response?.status 
          });
        }
      }
      
      const allSuccess = successCount === messages.length;
      if (allSuccess) {
        logger.info(`🎯 Tutti i ${messages.length} messaggi Discord inviati con successo`);
      } else {
        logger.warn(`⚠️ Inviati ${successCount}/${messages.length} messaggi Discord`);
      }
      
      return successCount > 0; // Successo anche se solo alcuni messaggi vanno a buon fine

    } catch (error) {
      logger.error('Errore durante l\'invio della notifica Discord', { error: error.message });
      return false;
    }
  }

  formatMultipleMessages(bestOffers) {
    const today = new Date().toLocaleDateString('it-IT');
    const totalBrands = Object.keys(bestOffers).length;
    let totalOffers = 0;

    // Conta il totale delle offerte
    for (const [brand, models] of Object.entries(bestOffers)) {
      totalOffers += Object.keys(models).length;
    }

    // Dividi i brand in gruppi per evitare messaggi troppo lunghi
    const brandEntries = Object.entries(bestOffers);
    const maxBrandsPerMessage = this.calculateMaxBrandsPerMessage(bestOffers);
    const messages = [];
    
    for (let i = 0; i < brandEntries.length; i += maxBrandsPerMessage) {
      const brandSlice = brandEntries.slice(i, i + maxBrandsPerMessage);
      const isFirstMessage = i === 0;
      const messageIndex = Math.floor(i / maxBrandsPerMessage) + 1;
      const totalMessages = Math.ceil(brandEntries.length / maxBrandsPerMessage);
      
      const message = this.formatSingleMessage(
        Object.fromEntries(brandSlice),
        today,
        totalBrands,
        totalOffers,
        isFirstMessage,
        messageIndex,
        totalMessages
      );
      
      messages.push(message);
    }

    return messages;
  }

  calculateMaxBrandsPerMessage(bestOffers) {
    // Stima approssimativa: ogni brand con modelli occupa circa 200-300 caratteri
    // Discord ha limite di 6000 caratteri per embed, usiamo 5000 per sicurezza
    let averageCharsPerBrand = 0;
    let brandCount = 0;
    
    for (const [brand, models] of Object.entries(bestOffers)) {
      const modelCount = Object.keys(models).length;
      // Stima: nome brand (15) + modelli (modelCount * 80) + formattazione (50)
      averageCharsPerBrand += 15 + (modelCount * 80) + 50;
      brandCount++;
    }
    
    averageCharsPerBrand = averageCharsPerBrand / brandCount;
    
    // Calcola quanti brand possiamo inserire in 5000 caratteri (con header/footer)
    const availableChars = 4500; // Lasciamo spazio per header e footer
    const maxBrands = Math.max(1, Math.floor(availableChars / averageCharsPerBrand));
    
    return Math.min(maxBrands, 8); // Massimo 8 brand per messaggio per leggibilità
  }

  formatSingleMessage(brandSubset, today, totalBrands, totalOffers, isFirstMessage, messageIndex, totalMessages) {
    // Calcola le offerte nel subset corrente
    let subsetOffers = 0;
    for (const [brand, models] of Object.entries(brandSubset)) {
      subsetOffers += Object.keys(models).length;
    }

    // Crea l'embed principale
    const embed = {
      title: totalMessages > 1 ? `🚗 Offerte Auto - Parte ${messageIndex}/${totalMessages}` : '🚗 Offerte Auto Noleggio Lungo Termine',
      description: isFirstMessage ? 
        `**${today}** • ${totalBrands} marche • ${totalOffers} offerte` :
        `**${today}** • Parte ${messageIndex} di ${totalMessages} (${subsetOffers} offerte in questo messaggio)`,
      color: 0x00ff00, // Verde
      timestamp: new Date().toISOString(),
      fields: [],
      footer: {
        text: 'Car Rental Bot • Range: €100-350/mese • Min: 48 mesi',
        icon_url: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png'
      }
    };

    // Ordina i brand alfabeticamente
    const sortedBrands = Object.keys(brandSubset).sort();

    for (const brand of sortedBrands) {
      const models = brandSubset[brand];
      const modelNames = Object.keys(models).sort();
      
      let brandText = '';
      
      for (const model of modelNames) {
        const offerInfo = models[model];
        const bestOffer = offerInfo.bestOffer;
        
        // Formatta la riga dell'offerta con icone per variazioni di prezzo
        let offerLine = `**${model}** • €${bestOffer.price}/mese`;
        
        // Aggiungi indicatori di variazione prezzo
        if (bestOffer.isNew || bestOffer.priceChange === 'new') {
          offerLine += ` 🆕`;
        } else if (bestOffer.priceChange === 'increased' && bestOffer.priceChangeAmount > 0) {
          offerLine += ` 🔺 +€${bestOffer.priceChangeAmount}`;
        } else if (bestOffer.priceChange === 'decreased' && bestOffer.priceChangeAmount > 0) {
          offerLine += ` 🔻 -€${bestOffer.priceChangeAmount}`;
        }
        
        // Aggiungi icone promo per Facile.it
        if (bestOffer.promo === 'promo_del_mese') {
          offerLine += ` 🕒`; // Clock icon for "PROMO DEL MESE"
        } else if (bestOffer.promo === 'offerta_esclusiva') {
          offerLine += ` ⭐`; // Star icon for "Offerta esclusiva Facile.it"
        }
        
        // Aggiungi anticipo se presente (per Ayvens)
        if (bestOffer.anticipo) {
          offerLine += ` (anticipo ${bestOffer.anticipo})`;
        }
        
        offerLine += ` • ${bestOffer.site}\n`;
        brandText += offerLine;
        
        // Se ci sono più offerte per lo stesso modello, mostra anche le altre
        if (offerInfo.allOffers.length > 1) {
          const otherOffers = offerInfo.allOffers.slice(1, 3); // Mostra al massimo 2 offerte aggiuntive
          for (const offer of otherOffers) {
            let otherLine = `└ €${offer.price}/mese`;
            
            // Aggiungi indicatori di variazione prezzo anche per offerte secondarie
            if (offer.isNew || offer.priceChange === 'new') {
              otherLine += ` 🆕`;
            } else if (offer.priceChange === 'increased' && offer.priceChangeAmount > 0) {
              otherLine += ` 🔺 +€${offer.priceChangeAmount}`;
            } else if (offer.priceChange === 'decreased' && offer.priceChangeAmount > 0) {
              otherLine += ` 🔻 -€${offer.priceChangeAmount}`;
            }
            
            // Aggiungi icone promo anche per offerte secondarie
            if (offer.promo === 'promo_del_mese') {
              otherLine += ` 🕒`; // Clock icon for "PROMO DEL MESE"
            } else if (offer.promo === 'offerta_esclusiva') {
              otherLine += ` ⭐`; // Star icon for "Offerta esclusiva Facile.it"
            }
            
            if (offer.anticipo) {
              otherLine += ` (anticipo ${offer.anticipo})`;
            }
            otherLine += ` • ${offer.site}\n`;
            brandText += otherLine;
          }
          if (offerInfo.allOffers.length > 3) {
            brandText += `└ ... e altre ${offerInfo.allOffers.length - 3} offerte\n`;
          }
        }
      }

      // Aggiungi il campo per questo brand
      embed.fields.push({
        name: `🔹 ${brand}`,
        value: brandText || 'Nessuna offerta trovata',
        inline: false
      });
    }

    // Se non ci sono offerte nel subset corrente
    if (subsetOffers === 0) {
      embed.color = 0xff0000; // Rosso
      embed.fields.push({
        name: '❌ Nessuna offerta trovata',
        value: 'Non sono state trovate offerte che rispettano i criteri specificati.',
        inline: false
      });
    }

    // Limita il numero di campi per evitare di superare i limiti di Discord
    if (embed.fields.length > 25) {
      embed.fields = embed.fields.slice(0, 24);
      embed.fields.push({
        name: '⚠️ Risultati limitati',
        value: 'Troppi risultati. Mostrando solo i primi 24 brand.',
        inline: false
      });
    }

    return embed;
  }

  async sendError(errorMessage) {
    try {
      if (!this.webhookUrl || this.webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
        return false;
      }

      const embed = {
        title: '❌ Errore Car Rental Bot',
        description: errorMessage,
        color: 0xff0000, // Rosso
        timestamp: new Date().toISOString(),
        footer: {
          text: 'Car Rental Bot Error',
          icon_url: 'https://cdn-icons-png.flaticon.com/512/753/753345.png'
        }
      };

      const payload = {
        content: null,
        embeds: [embed],
        username: 'Car Rental Bot',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/753/753345.png'
      };

      await axios.post(this.webhookUrl, payload);
      logger.info('Messaggio di errore Discord inviato');
      return true;

    } catch (error) {
      logger.error('Errore nell\'invio della notifica di errore Discord', { error: error.message });
      return false;
    }
  }

  async sendStartupMessage() {
    try {
      if (!this.webhookUrl || this.webhookUrl === 'YOUR_DISCORD_WEBHOOK_URL_HERE') {
        return false;
      }

      const embed = {
        title: '🤖 Car Rental Bot Avviato',
        description: 'Il bot è stato avviato con successo e inizierà il monitoraggio delle offerte.',
        color: 0x0099ff, // Blu
        timestamp: new Date().toISOString(),
        fields: [
          {
            name: '📋 Configurazione',
            value: `**Range prezzo:** €${config.scraping.minPrice}-${config.scraping.maxPrice}/mese\n**Durata minima:** ${config.scraping.minDurationMonths} mesi\n**Orario controllo:** ${config.scheduling.cronSchedule}`,
            inline: false
          },
          {
            name: '🌐 Siti monitorati',
            value: 'Ayvens, Alphabet, Leasys, Rentago',
            inline: false
          }
        ],
        footer: {
          text: 'Car Rental Bot',
          icon_url: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png'
        }
      };

      const payload = {
        content: null,
        embeds: [embed],
        username: 'Car Rental Bot',
        avatar_url: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png'
      };

      await axios.post(this.webhookUrl, payload);
      logger.info('Messaggio di avvio Discord inviato');
      return true;

    } catch (error) {
      logger.error('Errore nell\'invio del messaggio di avvio Discord', { error: error.message });
      return false;
    }
  }
}

module.exports = new DiscordNotifier();