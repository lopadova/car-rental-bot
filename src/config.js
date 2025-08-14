const dotenv = require('dotenv');
dotenv.config();

module.exports = {
  discord: {
    webhookUrl: process.env.DISCORD_WEBHOOK_URL
  },
  scraping: {
    minPrice: parseInt(process.env.MIN_PRICE) || 100,
    maxPrice: parseInt(process.env.MAX_PRICE) || 350,
    minDurationMonths: parseInt(process.env.MIN_DURATION_MONTHS) || 48,
    excludedBrands: process.env.EXCLUDED_BRANDS ? process.env.EXCLUDED_BRANDS.split(',').map(b => b.trim().toUpperCase()) : [],
    excludedModels: process.env.EXCLUDED_MODELS ? process.env.EXCLUDED_MODELS.split(',').map(m => m.trim().toUpperCase()) : [],
    includedModels: process.env.INCLUDED_MODELS ? process.env.INCLUDED_MODELS.split(',').map(m => m.trim().toUpperCase()) : []
  },
  scheduling: {
    cronSchedule: process.env.CRON_SCHEDULE || '0 8 * * *' // 8:00 AM ogni giorno
  },
  browser: {
    userAgent: process.env.USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    headless: process.env.HEADLESS === 'true',
    delayMin: parseInt(process.env.DELAY_MIN_MS) || 1000,
    delayMax: parseInt(process.env.DELAY_MAX_MS) || 3000
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  sites: {
    ayvens: 'https://noleggio.ayvens.com/it-it/noleggio-lungo-termine/',
    alphabet: 'https://www.alphabet.com/it-it/offerte-di-noleggio-lungo-termine',
    leasys: 'https://e-store.leasys.com/it/italiano/business',
    rentago: 'https://www.rentago.it/noleggio-a-lungo-termine/?p0=toscana&p1=rata-a-350',
    driveflee: 'https://driveflee.com/noleggio-a-lungo-termine/',
    yoyomove: 'https://www.yoyomove.com/it/offerte-noleggio-lungo-termine-aziende/?database_id=g_it_search_generic_nlt_exact'
  }
};