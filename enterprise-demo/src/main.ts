import express from 'express';
import { DatabaseManager } from './infrastructure/database/DatabaseManager';
import { RedisCache } from './infrastructure/cache/RedisCache';
import { Logger } from './shared/utils/Logger';
import { ConfigService } from './shared/config/ConfigService';
import { AuthenticationService } from './modules/auth/services/AuthenticationService';
import { UserController } from './modules/user/controllers/UserController';
import { ProductController } from './modules/product/controllers/ProductController';
import { OrderController } from './modules/order/controllers/OrderController';
import { PaymentController } from './modules/payment/controllers/PaymentController';
import { NotificationService } from './modules/notification/services/NotificationService';
import { InventoryService } from './modules/inventory/services/InventoryService';
import { AnalyticsService } from './modules/analytics/services/AnalyticsService';
import { WebSocketManager } from './infrastructure/websocket/WebSocketManager';
import { ErrorHandler } from './shared/middleware/ErrorHandler';
import { RateLimiter } from './shared/middleware/RateLimiter';
import { SecurityMiddleware } from './shared/middleware/SecurityMiddleware';

export class ECommerceApplication {
    private app: express.Application;
    private dbManager: DatabaseManager;
    private cache: RedisCache;
    private logger: Logger;
    private config: ConfigService;
    private authService: AuthenticationService;
    private notificationService: NotificationService;
    private inventoryService: InventoryService;
    private analyticsService: AnalyticsService;
    private wsManager: WebSocketManager;

    constructor() {
        this.app = express();
        this.logger = new Logger();
        this.config = new ConfigService();
        this.dbManager = new DatabaseManager(this.config, this.logger);
        this.cache = new RedisCache(this.config, this.logger);
        this.authService = new AuthenticationService(this.dbManager, this.cache, this.logger);
        this.notificationService = new NotificationService(this.config, this.logger);
        this.inventoryService = new InventoryService(this.dbManager, this.cache, this.logger);
        this.analyticsService = new AnalyticsService(this.dbManager, this.cache, this.logger);
        this.wsManager = new WebSocketManager(this.logger);
    }

    async initialize(): Promise<void> {
        try {
            this.logger.info('Initializing E-Commerce Platform...');
            
            // Initialize infrastructure
            await this.dbManager.connect();
            await this.cache.connect();
            await this.wsManager.initialize();
            
            // Setup middleware
            this.setupMiddleware();
            
            // Initialize services
            await this.authService.initialize();
            await this.notificationService.initialize();
            await this.inventoryService.initialize();
            await this.analyticsService.initialize();
            
            // Setup routes
            this.setupRoutes();
            
            // Setup error handling
            this.setupErrorHandling();
            
            this.logger.info('E-Commerce Platform initialized successfully');
        } catch (error) {
            this.logger.error('Failed to initialize platform:', error);
            throw error;
        }
    }

    private setupMiddleware(): void {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));
        this.app.use(new SecurityMiddleware().middleware);
        this.app.use(new RateLimiter(this.cache).middleware);
    }

    private setupRoutes(): void {
        const userController = new UserController(this.authService, this.logger);
        const productController = new ProductController(this.dbManager, this.cache, this.logger);
        const orderController = new OrderController(
            this.dbManager, 
            this.inventoryService, 
            this.notificationService, 
            this.analyticsService,
            this.logger
        );
        const paymentController = new PaymentController(
            this.dbManager, 
            this.notificationService, 
            this.logger
        );

        this.app.use('/api/auth', userController.router);
        this.app.use('/api/users', userController.router);
        this.app.use('/api/products', productController.router);
        this.app.use('/api/orders', orderController.router);
        this.app.use('/api/payments', paymentController.router);
    }

    private setupErrorHandling(): void {
        this.app.use(new ErrorHandler(this.logger).middleware);
    }

    async start(port: number = 3000): Promise<void> {
        await this.initialize();
        
        this.app.listen(port, () => {
            this.logger.info(`E-Commerce Platform running on port ${port}`);
        });
    }

    async shutdown(): Promise<void> {
        this.logger.info('Shutting down E-Commerce Platform...');
        
        await this.wsManager.close();
        await this.cache.disconnect();
        await this.dbManager.disconnect();
        
        this.logger.info('Platform shutdown complete');
    }
}

// Bootstrap the application
const platform = new ECommerceApplication();
platform.start().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', () => platform.shutdown());
process.on('SIGINT', () => platform.shutdown());