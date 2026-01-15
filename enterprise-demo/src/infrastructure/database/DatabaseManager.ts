import mongoose from 'mongoose';
import { ConfigService } from '../../shared/config/ConfigService';
import { Logger } from '../../shared/utils/Logger';
import { ConnectionError } from '../../shared/errors/ConnectionError';
import { UserRepository } from '../../modules/user/repositories/UserRepository';
import { ProductRepository } from '../../modules/product/repositories/ProductRepository';
import { OrderRepository } from '../../modules/order/repositories/OrderRepository';
import { PaymentRepository } from '../../modules/payment/repositories/PaymentRepository';

export class DatabaseManager {
    private connection: mongoose.Connection | null = null;
    private userRepository: UserRepository;
    private productRepository: ProductRepository;
    private orderRepository: OrderRepository;
    private paymentRepository: PaymentRepository;

    constructor(
        private config: ConfigService,
        private logger: Logger
    ) {
        this.userRepository = new UserRepository();
        this.productRepository = new ProductRepository();
        this.orderRepository = new OrderRepository();
        this.paymentRepository = new PaymentRepository();
    }

    async connect(): Promise<void> {
        try {
            const connectionString = this.config.getDatabaseUrl();
            
            await mongoose.connect(connectionString, {
                maxPoolSize: 10,
                serverSelectionTimeoutMS: 5000,
                socketTimeoutMS: 45000,
            });

            this.connection = mongoose.connection;
            
            this.connection.on('error', (error) => {
                this.logger.error('Database connection error:', error);
            });

            this.connection.on('disconnected', () => {
                this.logger.warn('Database disconnected');
            });

            this.connection.on('reconnected', () => {
                this.logger.info('Database reconnected');
            });

            this.logger.info('Database connected successfully');
        } catch (error) {
            this.logger.error('Failed to connect to database:', error);
            throw new ConnectionError('Database connection failed');
        }
    }

    async disconnect(): Promise<void> {
        if (this.connection) {
            await mongoose.disconnect();
            this.connection = null;
            this.logger.info('Database disconnected');
        }
    }

    async healthCheck(): Promise<boolean> {
        try {
            if (!this.connection) return false;
            
            await mongoose.connection.db.admin().ping();
            return true;
        } catch (error) {
            this.logger.error('Database health check failed:', error);
            return false;
        }
    }

    // Repository getters
    get users(): UserRepository {
        return this.userRepository;
    }

    get products(): ProductRepository {
        return this.productRepository;
    }

    get orders(): OrderRepository {
        return this.orderRepository;
    }

    get payments(): PaymentRepository {
        return this.paymentRepository;
    }

    async startTransaction(): Promise<mongoose.ClientSession> {
        const session = await mongoose.startSession();
        session.startTransaction();
        return session;
    }

    async commitTransaction(session: mongoose.ClientSession): Promise<void> {
        await session.commitTransaction();
        session.endSession();
    }

    async abortTransaction(session: mongoose.ClientSession): Promise<void> {
        await session.abortTransaction();
        session.endSession();
    }
}