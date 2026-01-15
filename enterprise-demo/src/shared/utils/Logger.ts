import winston from 'winston';
import { ConfigService } from '../config/ConfigService';

export class Logger {
    private logger: winston.Logger;
    private config: ConfigService;

    constructor() {
        this.config = new ConfigService();
        this.logger = this.createLogger();
    }

    private createLogger(): winston.Logger {
        const logLevel = this.config.getLogLevel();
        const environment = this.config.getEnvironment();

        const formats = [
            winston.format.timestamp(),
            winston.format.errors({ stack: true }),
            winston.format.json()
        ];

        if (environment === 'development') {
            formats.push(
                winston.format.colorize(),
                winston.format.simple()
            );
        }

        return winston.createLogger({
            level: logLevel,
            format: winston.format.combine(...formats),
            defaultMeta: {
                service: 'ecommerce-platform',
                environment
            },
            transports: [
                new winston.transports.Console(),
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

    info(message: string, meta?: any): void {
        this.logger.info(message, meta);
    }

    error(message: string, error?: any): void {
        this.logger.error(message, { error });
    }

    warn(message: string, meta?: any): void {
        this.logger.warn(message, meta);
    }

    debug(message: string, meta?: any): void {
        this.logger.debug(message, meta);
    }
}