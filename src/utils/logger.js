const fs = require('fs');
const path = require('path');
const config = require('../config');

class Logger {
  constructor() {
    this.logToFile = config.logging.logToFile;
    this.logStream = null;
    this.logFilePath = null;
    this.logDir = path.join(process.cwd(), 'logs');
    
    if (this.logToFile) {
      this.initializeFileLogging();
    }
  }

  initializeFileLogging() {
    // Create logs directory if it doesn't exist
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
    
    // Create log file with timestamp in format: car-rental-bot-YYYY-MM-DD_HH-MM-SS.log
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    
    const logFileName = `car-rental-bot-${year}-${month}-${day}_${hours}-${minutes}-${seconds}.log`;
    this.logFilePath = path.join(this.logDir, logFileName);
    
    // Create write stream
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a', encoding: 'utf8' });
    
    // Log initialization
    this.writeToFile(`=== Log Started at ${now.toISOString()} ===`);
  }

  formatMessage(level, args) {
    const timestamp = new Date().toISOString();
    const message = args.map(arg => {
      if (typeof arg === 'object') {
        try {
          return JSON.stringify(arg, null, 2);
        } catch (error) {
          return String(arg);
        }
      }
      return String(arg);
    }).join(' ');
    
    return `[${timestamp}] [${level.toUpperCase()}] ${message}`;
  }

  writeToFile(message) {
    if (this.logStream && this.logStream.writable) {
      this.logStream.write(message + '\n');
    }
  }

  log(...args) {
    // Always output to console
    console.log(...args);
    
    // If file logging is enabled, also write to file
    if (this.logToFile) {
      const formattedMessage = this.formatMessage('info', args);
      this.writeToFile(formattedMessage);
    }
  }

  error(...args) {
    // Always output to console
    console.error(...args);
    
    // If file logging is enabled, also write to file
    if (this.logToFile) {
      const formattedMessage = this.formatMessage('error', args);
      this.writeToFile(formattedMessage);
    }
  }

  warn(...args) {
    // Always output to console
    console.warn(...args);
    
    // If file logging is enabled, also write to file
    if (this.logToFile) {
      const formattedMessage = this.formatMessage('warn', args);
      this.writeToFile(formattedMessage);
    }
  }

  info(...args) {
    // Always output to console
    console.info(...args);
    
    // If file logging is enabled, also write to file
    if (this.logToFile) {
      const formattedMessage = this.formatMessage('info', args);
      this.writeToFile(formattedMessage);
    }
  }

  debug(...args) {
    // Only output if debug level is enabled
    if (config.logging.level === 'debug') {
      console.debug(...args);
      
      // If file logging is enabled, also write to file
      if (this.logToFile) {
        const formattedMessage = this.formatMessage('debug', args);
        this.writeToFile(formattedMessage);
      }
    }
  }

  // Compatibility methods for async calls
  async writeLog(level, message, data = null) {
    const args = data ? [message, data] : [message];
    
    switch(level.toLowerCase()) {
      case 'info':
        this.info(...args);
        break;
      case 'error':
        this.error(...args);
        break;
      case 'warn':
        this.warn(...args);
        break;
      case 'debug':
        this.debug(...args);
        break;
      default:
        this.log(...args);
    }
  }

  close() {
    if (this.logStream) {
      this.writeToFile(`=== Log Ended at ${new Date().toISOString()} ===`);
      this.logStream.end();
    }
  }
}

// Create singleton instance
const logger = new Logger();

// Handle process exit
process.on('exit', () => {
  logger.close();
});

process.on('SIGINT', () => {
  logger.close();
  process.exit();
});

process.on('SIGTERM', () => {
  logger.close();
  process.exit();
});

module.exports = logger;