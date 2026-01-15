import { UserService } from './services/UserService';
import { DatabaseManager } from './database/DatabaseManager';
import { Logger } from './utils/Logger';

export class Application {
    private userService: UserService;
    private dbManager: DatabaseManager;
    private logger: Logger;

    constructor() {
        this.logger = new Logger();
        this.dbManager = new DatabaseManager();
        this.userService = new UserService(this.dbManager);
    }

    async start(): Promise<void> {
        try {
            this.logger.info('Starting application...');
            await this.dbManager.connect();
            await this.userService.initialize();
            this.logger.info('Application started successfully');
        } catch (error) {
            this.logger.error('Failed to start application:', error);
            throw error;
        }
    }

    async shutdown(): Promise<void> {
        this.logger.info('Shutting down application...');
        await this.dbManager.disconnect();
        this.logger.info('Application shut down complete');
    }
}

// Bootstrap the application
const app = new Application();
app.start().catch(console.error);