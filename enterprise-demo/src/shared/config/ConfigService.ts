export class ConfigService {
    private config: { [key: string]: any };

    constructor() {
        this.config = {
            database: {
                url: process.env.DATABASE_URL || 'mongodb://localhost:27017/ecommerce',
                maxPoolSize: parseInt(process.env.DB_MAX_POOL_SIZE || '10'),
            },
            redis: {
                url: process.env.REDIS_URL || 'redis://localhost:6379',
            },
            jwt: {
                secret: process.env.JWT_SECRET || 'your-secret-key',
                refreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
                accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
                refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
            },
            server: {
                port: parseInt(process.env.PORT || '3000'),
                environment: process.env.NODE_ENV || 'development',
            },
            logging: {
                level: process.env.LOG_LEVEL || 'info',
            },
            payment: {
                stripeSecretKey: process.env.STRIPE_SECRET_KEY,
                stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY,
            },
            email: {
                host: process.env.EMAIL_HOST,
                port: parseInt(process.env.EMAIL_PORT || '587'),
                user: process.env.EMAIL_USER,
                password: process.env.EMAIL_PASSWORD,
            }
        };
    }

    getDatabaseUrl(): string {
        return this.config.database.url;
    }

    getRedisUrl(): string {
        return this.config.redis.url;
    }

    getJwtSecret(): string {
        return this.config.jwt.secret;
    }

    getRefreshTokenSecret(): string {
        return this.config.jwt.refreshSecret;
    }

    getAccessTokenExpiry(): string {
        return this.config.jwt.accessTokenExpiry;
    }

    getRefreshTokenExpiry(): string {
        return this.config.jwt.refreshTokenExpiry;
    }

    getRefreshTokenTtl(): number {
        // Convert expiry string to seconds
        const expiry = this.config.jwt.refreshTokenExpiry;
        if (expiry.endsWith('d')) {
            return parseInt(expiry) * 24 * 60 * 60;
        }
        if (expiry.endsWith('h')) {
            return parseInt(expiry) * 60 * 60;
        }
        if (expiry.endsWith('m')) {
            return parseInt(expiry) * 60;
        }
        return parseInt(expiry);
    }

    getServerPort(): number {
        return this.config.server.port;
    }

    getEnvironment(): string {
        return this.config.server.environment;
    }

    getLogLevel(): string {
        return this.config.logging.level;
    }

    getStripeSecretKey(): string {
        return this.config.payment.stripeSecretKey;
    }

    getEmailConfig(): any {
        return this.config.email;
    }
}