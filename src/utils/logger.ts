import fs from 'fs';
import path from 'path';
import { config } from '../config/config';

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };
const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',
  info:  '\x1b[32m',
  warn:  '\x1b[33m',
  error: '\x1b[31m',
};
const RESET = '\x1b[0m';

function formatLine(level: LogLevel, message: string, meta?: object): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] ${message}`;
  return meta ? `${base} ${JSON.stringify(meta)}` : base;
}

function write(level: LogLevel, message: string, meta?: object) {
  const currentLevel = (config.logging.level as LogLevel) ?? 'info';
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const line = formatLine(level, message, meta);

  // Console with colour
  console.log(`${COLORS[level]}${line}${RESET}`);

  // Append to daily log file
  try {
    const dir = config.logging.dir;
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const date = new Date().toISOString().slice(0, 10);
    fs.appendFileSync(path.join(dir, `${date}.log`), line + '\n');
  } catch {
    // Non-blocking: if log dir is unavailable, fall back to console only
  }
}

export const logger = {
  debug: (msg: string, meta?: object) => write('debug', msg, meta),
  info:  (msg: string, meta?: object) => write('info',  msg, meta),
  warn:  (msg: string, meta?: object) => write('warn',  msg, meta),
  error: (msg: string, meta?: object) => write('error', msg, meta),
};
