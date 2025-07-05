import winston from 'winston';
import type { ServerConfig } from '../types/index.js';

/**
 * Create and configure Winston logger
 */
export function createLogger(config: ServerConfig['logging']): winston.Logger {
  const formats = [
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
  ];

  if (config.format === 'json') {
    formats.push(winston.format.json());
  } else {
    formats.push(
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, stack }) => {
        return `${timestamp} ${level}: ${stack || message}`;
      })
    );
  }

  return winston.createLogger({
    level: config.level,
    format: winston.format.combine(...formats),
    transports: [
      new winston.transports.File({ 
        filename: 'logs/error.log', 
        level: 'error' 
      }),
      new winston.transports.File({ 
        filename: 'logs/combined.log' 
      })
    ]
  });
}

/**
 * Simple console logger for development
 */
export const logger = {
  error: console.error,
  warn: console.warn,
  info: console.log,
  debug: console.debug
};
