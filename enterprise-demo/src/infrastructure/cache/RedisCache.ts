import { createClient, RedisClientType } from 'redis';
import { ConfigService } from '../../shared/config/ConfigService';
import { Logger } from '../../shared/utils/Logger';
import { ConnectionError } from '../../shared/errors/ConnectionError';

export class RedisCache {
    private client: RedisClientType | null = null;
    private isConnected: boolean = false;

    constructor(
        private config: ConfigService,
        private logger: Logger
    ) {}

    async connect(): Promise<void> {
        try {
            this.client = createClient({
                url: this.config.getRedisUrl(),
                socket: {
                    connectTimeout: 5000,
                    lazyConnect: true
                }
            });

            this.client.on('error', (error) => {
                this.logger.error('Redis connection error:', error);
                this.isConnected = false;
            });

            this.client.on('connect', () => {
                this.logger.info('Redis connected');
                this.isConnected = true;
            });

            this.client.on('disconnect', () => {
                this.logger.warn('Redis disconnected');
                this.isConnected = false;
            });

            await this.client.connect();
            this.logger.info('Redis cache connected successfully');
        } catch (error) {
            this.logger.error('Failed to connect to Redis:', error);
            throw new ConnectionError('Redis connection failed');
        }
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            await this.client.quit();
            this.client = null;
            this.isConnected = false;
            this.logger.info('Redis cache disconnected');
        }
    }

    async get<T>(key: string): Promise<T | null> {
        if (!this.client || !this.isConnected) {
            this.logger.warn('Redis not connected, cache miss for key:', key);
            return null;
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            this.logger.error('Redis get error:', error);
            return null;
        }
    }

    async set(key: string, value: any, ttlSeconds?: number): Promise<void> {
        if (!this.client || !this.isConnected) {
            this.logger.warn('Redis not connected, skipping cache set for key:', key);
            return;
        }

        try {
            const serialized = JSON.stringify(value);
            if (ttlSeconds) {
                await this.client.setEx(key, ttlSeconds, serialized);
            } else {
                await this.client.set(key, serialized);
            }
        } catch (error) {
            this.logger.error('Redis set error:', error);
        }
    }

    async delete(key: string): Promise<void> {
        if (!this.client || !this.isConnected) {
            return;
        }

        try {
            await this.client.del(key);
        } catch (error) {
            this.logger.error('Redis delete error:', error);
        }
    }

    async exists(key: string): Promise<boolean> {
        if (!this.client || !this.isConnected) {
            return false;
        }

        try {
            const result = await this.client.exists(key);
            return result === 1;
        } catch (error) {
            this.logger.error('Redis exists error:', error);
            return false;
        }
    }

    async increment(key: string, amount: number = 1): Promise<number> {
        if (!this.client || !this.isConnected) {
            throw new Error('Redis not connected');
        }

        try {
            return await this.client.incrBy(key, amount);
        } catch (error) {
            this.logger.error('Redis increment error:', error);
            throw error;
        }
    }

    async expire(key: string, ttlSeconds: number): Promise<void> {
        if (!this.client || !this.isConnected) {
            return;
        }

        try {
            await this.client.expire(key, ttlSeconds);
        } catch (error) {
            this.logger.error('Redis expire error:', error);
        }
    }

    async flushAll(): Promise<void> {
        if (!this.client || !this.isConnected) {
            return;
        }

        try {
            await this.client.flushAll();
            this.logger.info('Redis cache flushed');
        } catch (error) {
            this.logger.error('Redis flush error:', error);
        }
    }

    isHealthy(): boolean {
        return this.isConnected && this.client !== null;
    }
}