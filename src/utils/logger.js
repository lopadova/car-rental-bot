const fs = require('fs-extra');
const path = require('path');

class Logger {
  constructor() {
    this.logDir = path.join(__dirname, '../../logs');
    this.ensureLogDir();
  }

  async ensureLogDir() {
    await fs.ensureDir(this.logDir);
  }

  formatMessage(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(data && { data })
    };
    return JSON.stringify(logEntry, null, 2);
  }

  async writeLog(level, message, data = null) {
    const formattedMessage = this.formatMessage(level, message, data);
    
    // Console output
    console.log(`[${new Date().toISOString()}] ${level.toUpperCase()}: ${message}`);
    if (data) {
      console.log(JSON.stringify(data, null, 2));
    }

    // File output
    const logFile = path.join(this.logDir, `${new Date().toISOString().split('T')[0]}.log`);
    await fs.appendFile(logFile, formattedMessage + '\n');
  }

  async info(message, data = null) {
    await this.writeLog('info', message, data);
  }

  async error(message, data = null) {
    await this.writeLog('error', message, data);
  }

  async warn(message, data = null) {
    await this.writeLog('warn', message, data);
  }

  async debug(message, data = null) {
    await this.writeLog('debug', message, data);
  }
}

module.exports = new Logger();