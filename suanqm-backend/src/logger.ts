import { promises as fs } from 'fs';
import { join } from 'path';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  LOG = 4
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  prefix?: string;
}

type LogCallback = (entry: LogEntry) => void;

class Logger {
  private level: LogLevel;
  private prefix: string;
  private logCallbacks: LogCallback[] = [];
  private logHistory: LogEntry[] = [];
  private maxHistorySize: number = 10000;
  private logFilePath: string;
  private enableFileLogging: boolean = true;
  private writeQueue: LogEntry[] = [];
  private isWriting: boolean = false;

  constructor(level: LogLevel = LogLevel.DEBUG, prefix: string = '') {
    this.level = level;
    this.prefix = prefix;
    this.logFilePath = join(process.cwd(), 'logs', 'app.log');
    this.initializeLogDirectory();
  }

  private async initializeLogDirectory(): Promise<void> {
    try {
      const logsDir = join(process.cwd(), 'logs');
      await fs.mkdir(logsDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create logs directory:', error);
    }
  }

  registerLogCallback(callback: LogCallback): void {
    this.logCallbacks.push(callback);
  }

  unregisterLogCallback(callback: LogCallback): void {
    const index = this.logCallbacks.indexOf(callback);
    if (index > -1) {
      this.logCallbacks.splice(index, 1);
    }
  }

  private notifyCallbacks(entry: LogEntry): void {
    setImmediate(() => {
      this.logCallbacks.forEach(callback => {
        try {
          callback(entry);
        } catch (error) {
          console.error('Error in log callback:', error);
        }
      });
    });
  }

  private addToHistory(entry: LogEntry): void {
    this.logHistory.push(entry);
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.enableFileLogging) return;

    this.writeQueue.push(entry);
    setImmediate(() => {
      this.processWriteQueue().catch(error => {
        console.error('Error processing write queue:', error);
      });
    });
  }

  private async processWriteQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return;

    this.isWriting = true;
    try {
      const entriesToWrite = this.writeQueue.splice(0, 100);
      const logLines = entriesToWrite.map(entry => 
        JSON.stringify(entry)
      ).join('\n') + '\n';

      await fs.appendFile(this.logFilePath, logLines, 'utf8');
    } catch (error) {
      console.error('Failed to write logs to file:', error);
    } finally {
      this.isWriting = false;
      if (this.writeQueue.length > 0) {
        setImmediate(() => {
          this.processWriteQueue().catch(error => {
            console.error('Error processing write queue:', error);
          });
        });
      }
    }
  }

  private formatMessage(level: string, ...args: any[]): string {
    const timestamp = new Date().toISOString();
    const prefix = this.prefix ? `[${this.prefix}] ` : '';
    const message = args.map(arg => 
      typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
    ).join(' ');
    return `${prefix}${level}: ${message}`;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.level;
  }

  private logToWebSocket(level: string, ...args: any[]): void {
    const entry: LogEntry = {
      level,
      message: args.map(arg => 
        typeof arg === 'object' ? JSON.stringify(arg, null, 2) : String(arg)
      ).join(' '),
      timestamp: new Date().toISOString(),
      prefix: this.prefix || undefined
    };
    this.notifyCallbacks(entry);
    this.addToHistory(entry);
    this.writeToFile(entry);
  }

  debug(...args: any[]): void {
    if (this.shouldLog(LogLevel.DEBUG)) {
      console.log(this.formatMessage('DEBUG', ...args));
      this.logToWebSocket('DEBUG', ...args);
    }
  }

  info(...args: any[]): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.log(this.formatMessage('INFO', ...args));
      this.logToWebSocket('INFO', ...args);
    }
  }

  warn(...args: any[]): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', ...args));
      this.logToWebSocket('WARN', ...args);
    }
  }

  error(...args: any[]): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', ...args));
      this.logToWebSocket('ERROR', ...args);
    }
  }

  log(...args: any[]): void {
    if (this.shouldLog(LogLevel.LOG)) {
      console.log(this.formatMessage('LOG', ...args));
      this.logToWebSocket('LOG', ...args);
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }

  setPrefix(prefix: string): void {
    this.prefix = prefix;
  }

  getHistory(options: {
    level?: string;
    limit?: number;
    offset?: number;
  } = {}): { logs: LogEntry[]; total: number } {
    const { level, limit = 100, offset = 0 } = options;

    let filteredLogs = this.logHistory;

    if (level) {
      filteredLogs = this.logHistory.filter(log => log.level === level);
    }

    const total = filteredLogs.length;
    const startIndex = Math.max(0, total - offset - limit);
    const endIndex = total - offset;
    const logs = filteredLogs.slice(startIndex, endIndex);

    return { logs, total };
  }

  async getLogsFromFile(options: {
    level?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: LogEntry[]; total: number }> {
    try {
      const content = await fs.readFile(this.logFilePath, 'utf8');
      const lines = content.trim().split('\n').filter(line => line);
      const allLogs: LogEntry[] = lines.map(line => {
        try {
          return JSON.parse(line);
        } catch {
          return null;
        }
      }).filter((log): log is LogEntry => log !== null);

      let filteredLogs = allLogs;

      if (options.level) {
        filteredLogs = allLogs.filter(log => log.level === options.level);
      }

      const total = filteredLogs.length;
      const offset = options.offset || 0;
      const limit = options.limit || 100;
      const startIndex = Math.max(0, total - offset - limit);
      const endIndex = total - offset;
      const logs = filteredLogs.slice(startIndex, endIndex);

      return { logs, total };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { logs: [], total: 0 };
      }
      throw error;
    }
  }

  async getAllLogs(options: {
    level?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<{ logs: LogEntry[]; total: number }> {
    const { level, limit = 100, offset = 0 } = options;

    const fileLogs = await this.getLogsFromFile({ level, limit: Infinity, offset: 0 });
    const historyLogs = this.getHistory({ level, limit: Infinity, offset: 0 });

    const allLogs = [...fileLogs.logs, ...historyLogs.logs];
    const uniqueLogs = this.removeDuplicates(allLogs);

    const total = uniqueLogs.length;
    const startIndex = Math.max(0, total - offset - limit);
    const endIndex = total - offset;
    const logs = uniqueLogs.slice(startIndex, endIndex);

    return { logs, total };
  }

  private removeDuplicates(logs: LogEntry[]): LogEntry[] {
    const seen = new Set<string>();
    return logs.filter(log => {
      const key = `${log.timestamp}-${log.level}-${log.message}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }

  async clearLogFile(): Promise<void> {
    try {
      await fs.writeFile(this.logFilePath, '', 'utf8');
    } catch (error) {
      console.error('Failed to clear log file:', error);
      throw error;
    }
  }

  clearHistory(): void {
    this.logHistory = [];
  }

  async clearAllLogs(): Promise<void> {
    await this.clearLogFile();
    this.clearHistory();
  }

  setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(0, size);
    while (this.logHistory.length > this.maxHistorySize) {
      this.logHistory.shift();
    }
  }

  setFileLogging(enabled: boolean): void {
    this.enableFileLogging = enabled;
  }

  setLogFilePath(path: string): void {
    this.logFilePath = path;
  }
}

const logger = new Logger(LogLevel.DEBUG);

export { logger, LogLevel, LogEntry, LogCallback };