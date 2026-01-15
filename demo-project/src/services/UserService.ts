import { DatabaseManager } from '../database/DatabaseManager';
import { Logger } from '../utils/Logger';
import { User } from '../models/User';
import { ValidationError } from '../errors/ValidationError';

export class UserService {
    private db: DatabaseManager;
    private logger: Logger;
    private cache: Map<string, User> = new Map();

    constructor(dbManager: DatabaseManager) {
        this.db = dbManager;
        this.logger = new Logger();
    }

    async initialize(): Promise<void> {
        this.logger.info('Initializing UserService...');
        // Complex initialization logic with multiple conditions
        if (!this.db.isConnected()) {
            throw new Error('Database not connected');
        }
        
        // Load initial user data
        const users = await this.db.query('SELECT * FROM users LIMIT 100');
        for (const userData of users) {
            const user = new User(userData);
            this.cache.set(user.id, user);
        }
        
        this.logger.info(`UserService initialized with ${this.cache.size} users`);
    }

    async createUser(userData: any): Promise<User> {
        // Complex validation logic
        if (!userData.email || !userData.name) {
            throw new ValidationError('Email and name are required');
        }
        
        if (userData.email.length < 5 || !userData.email.includes('@')) {
            throw new ValidationError('Invalid email format');
        }
        
        if (userData.name.length < 2) {
            throw new ValidationError('Name must be at least 2 characters');
        }
        
        // Check for existing user
        const existingUser = await this.findUserByEmail(userData.email);
        if (existingUser) {
            throw new ValidationError('User with this email already exists');
        }
        
        // Create new user
        const user = new User(userData);
        await this.db.insert('users', user.toJSON());
        this.cache.set(user.id, user);
        
        this.logger.info(`Created user: ${user.email}`);
        return user;
    }

    async findUserByEmail(email: string): Promise<User | null> {
        // Check cache first
        for (const user of this.cache.values()) {
            if (user.email === email) {
                return user;
            }
        }
        
        // Query database
        const result = await this.db.query('SELECT * FROM users WHERE email = ?', [email]);
        if (result.length > 0) {
            const user = new User(result[0]);
            this.cache.set(user.id, user);
            return user;
        }
        
        return null;
    }

    async updateUser(id: string, updates: Partial<User>): Promise<User> {
        const user = this.cache.get(id);
        if (!user) {
            throw new Error('User not found');
        }
        
        // Apply updates with validation
        if (updates.email && updates.email !== user.email) {
            const existingUser = await this.findUserByEmail(updates.email);
            if (existingUser && existingUser.id !== id) {
                throw new ValidationError('Email already in use');
            }
        }
        
        Object.assign(user, updates);
        await this.db.update('users', id, user.toJSON());
        
        this.logger.info(`Updated user: ${user.email}`);
        return user;
    }

    async deleteUser(id: string): Promise<void> {
        const user = this.cache.get(id);
        if (!user) {
            throw new Error('User not found');
        }
        
        await this.db.delete('users', id);
        this.cache.delete(id);
        
        this.logger.info(`Deleted user: ${user.email}`);
    }

    getUserStats(): { total: number; cached: number } {
        return {
            total: this.cache.size,
            cached: this.cache.size
        };
    }
}