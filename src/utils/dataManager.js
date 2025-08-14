const fs = require('fs-extra');
const path = require('path');
const logger = require('./logger');

class DataManager {
  constructor() {
    this.dataDir = path.join(__dirname, '../../data');
    this.offersFile = path.join(this.dataDir, 'offers.json');
    this.historyFile = path.join(this.dataDir, 'history.json');
    this.statsFile = path.join(this.dataDir, 'stats.json');
  }

  async init() {
    try {
      await fs.ensureDir(this.dataDir);
      
      // Inizializza i file se non esistono
      if (!await fs.pathExists(this.offersFile)) {
        await fs.writeJson(this.offersFile, []);
      }
      
      if (!await fs.pathExists(this.historyFile)) {
        await fs.writeJson(this.historyFile, []);
      }
      
      if (!await fs.pathExists(this.statsFile)) {
        await fs.writeJson(this.statsFile, {
          totalRuns: 0,
          lastRun: null,
          totalOffersFound: 0,
          siteStats: {}
        });
      }
      
      logger.info('DataManager inizializzato');
    } catch (error) {
      logger.error('Errore durante l\'inizializzazione del DataManager', { error: error.message });
    }
  }

  async saveOffers(offers) {
    try {
      const timestamp = new Date().toISOString();
      
      // Salva le offerte attuali
      await fs.writeJson(this.offersFile, {
        timestamp,
        offers,
        count: offers.length
      }, { spaces: 2 });
      
      // Aggiungi alla cronologia
      await this.addToHistory({
        timestamp,
        offerCount: offers.length,
        siteBreakdown: this.getSiteBreakdown(offers)
      });
      
      // Aggiorna le statistiche
      await this.updateStats(offers);
      
      logger.info(`Salvate ${offers.length} offerte`);
      return true;
    } catch (error) {
      logger.error('Errore durante il salvataggio delle offerte', { error: error.message });
      return false;
    }
  }

  async compareWithPrevious(newOffers) {
    try {
      logger.info('🔍 Confronto offerte con storico precedente...');
      
      // Carica offerte precedenti
      const previousOffers = await this.loadOffers();
      
      if (previousOffers.length === 0) {
        logger.info('📝 Prima esecuzione: tutte le offerte sono nuove');
        return newOffers.map(offer => ({
          ...offer,
          isNew: true,
          priceChange: null,
          priceChangeAmount: 0
        }));
      }
      
      // Crea mappa delle offerte precedenti per confronto veloce
      const previousMap = new Map();
      for (const offer of previousOffers) {
        const key = `${offer.brand}-${offer.model}`;
        previousMap.set(key, offer);
      }
      
      // Confronta ogni nuova offerta
      const comparedOffers = newOffers.map(newOffer => {
        const key = `${newOffer.brand}-${newOffer.model}`;
        const previousOffer = previousMap.get(key);
        
        if (!previousOffer) {
          // Offerta completamente nuova
          return {
            ...newOffer,
            isNew: true,
            priceChange: 'new',
            priceChangeAmount: 0
          };
        }
        
        // Confronta prezzi
        const newPrice = newOffer.price;
        const oldPrice = previousOffer.price;
        
        if (newPrice === oldPrice) {
          // Prezzo uguale
          return {
            ...newOffer,
            isNew: false,
            priceChange: 'same',
            priceChangeAmount: 0
          };
        } else if (newPrice > oldPrice) {
          // Prezzo aumentato
          return {
            ...newOffer,
            isNew: false,
            priceChange: 'increased',
            priceChangeAmount: newPrice - oldPrice
          };
        } else {
          // Prezzo diminuito
          return {
            ...newOffer,
            isNew: false,
            priceChange: 'decreased',
            priceChangeAmount: oldPrice - newPrice
          };
        }
      });
      
      const newCount = comparedOffers.filter(o => o.isNew).length;
      const increasedCount = comparedOffers.filter(o => o.priceChange === 'increased').length;
      const decreasedCount = comparedOffers.filter(o => o.priceChange === 'decreased').length;
      const sameCount = comparedOffers.filter(o => o.priceChange === 'same').length;
      
      logger.info(`📊 Confronto completato: ${newCount} nuove, ${increasedCount} aumentate, ${decreasedCount} diminuite, ${sameCount} invariate`);
      
      return comparedOffers;
      
    } catch (error) {
      logger.error('❌ Errore durante il confronto con precedenti:', error.message);
      // In caso di errore, restituisci le offerte senza confronto
      return newOffers.map(offer => ({
        ...offer,
        isNew: false,
        priceChange: null,
        priceChangeAmount: 0
      }));
    }
  }

  async loadOffers() {
    try {
      if (!await fs.pathExists(this.offersFile)) {
        return [];
      }
      
      const data = await fs.readJson(this.offersFile);
      return data.offers || [];
    } catch (error) {
      logger.error('Errore durante il caricamento delle offerte', { error: error.message });
      return [];
    }
  }

  async addToHistory(entry) {
    try {
      let history = [];
      
      if (await fs.pathExists(this.historyFile)) {
        history = await fs.readJson(this.historyFile);
      }
      
      history.push(entry);
      
      // Mantieni solo gli ultimi 30 giorni
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      history = history.filter(item => new Date(item.timestamp) > thirtyDaysAgo);
      
      await fs.writeJson(this.historyFile, history, { spaces: 2 });
    } catch (error) {
      logger.error('Errore durante l\'aggiunta alla cronologia', { error: error.message });
    }
  }

  async updateStats(offers) {
    try {
      let stats = {
        totalRuns: 0,
        lastRun: null,
        totalOffersFound: 0,
        siteStats: {}
      };
      
      if (await fs.pathExists(this.statsFile)) {
        stats = await fs.readJson(this.statsFile);
      }
      
      // Aggiorna le statistiche
      stats.totalRuns += 1;
      stats.lastRun = new Date().toISOString();
      stats.totalOffersFound += offers.length;
      
      // Aggiorna statistiche per sito
      const siteBreakdown = this.getSiteBreakdown(offers);
      for (const [site, count] of Object.entries(siteBreakdown)) {
        if (!stats.siteStats[site]) {
          stats.siteStats[site] = {
            totalOffers: 0,
            runs: 0,
            averageOffers: 0
          };
        }
        
        stats.siteStats[site].totalOffers += count;
        stats.siteStats[site].runs += 1;
        stats.siteStats[site].averageOffers = Math.round(
          stats.siteStats[site].totalOffers / stats.siteStats[site].runs
        );
      }
      
      await fs.writeJson(this.statsFile, stats, { spaces: 2 });
    } catch (error) {
      logger.error('Errore durante l\'aggiornamento delle statistiche', { error: error.message });
    }
  }

  getSiteBreakdown(offers) {
    const breakdown = {};
    
    for (const offer of offers) {
      if (!breakdown[offer.site]) {
        breakdown[offer.site] = 0;
      }
      breakdown[offer.site] += 1;
    }
    
    return breakdown;
  }

  async getStats() {
    try {
      if (!await fs.pathExists(this.statsFile)) {
        return null;
      }
      
      return await fs.readJson(this.statsFile);
    } catch (error) {
      logger.error('Errore durante il caricamento delle statistiche', { error: error.message });
      return null;
    }
  }

  async getHistory(days = 7) {
    try {
      if (!await fs.pathExists(this.historyFile)) {
        return [];
      }
      
      const history = await fs.readJson(this.historyFile);
      
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - days);
      
      return history.filter(item => new Date(item.timestamp) > daysAgo);
    } catch (error) {
      logger.error('Errore durante il caricamento della cronologia', { error: error.message });
      return [];
    }
  }

  // Pulisce i dati vecchi
  async cleanup() {
    try {
      // Pulisci la cronologia (mantieni solo 30 giorni)
      if (await fs.pathExists(this.historyFile)) {
        let history = await fs.readJson(this.historyFile);
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        history = history.filter(item => new Date(item.timestamp) > thirtyDaysAgo);
        await fs.writeJson(this.historyFile, history, { spaces: 2 });
      }
      
      // Pulisci i log vecchi
      const logsDir = path.join(__dirname, '../../logs');
      if (await fs.pathExists(logsDir)) {
        const files = await fs.readdir(logsDir);
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        for (const file of files) {
          const filePath = path.join(logsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < sevenDaysAgo) {
            await fs.remove(filePath);
            logger.debug(`Rimosso log vecchio: ${file}`);
          }
        }
      }
      
      logger.info('Cleanup dei dati completato');
    } catch (error) {
      logger.error('Errore durante il cleanup', { error: error.message });
    }
  }
}

module.exports = new DataManager();