import { Router, Request, Response } from 'express';
import { AuthenticationService } from '../services/AuthenticationService';
import { UserService } from '../services/UserService';
import { UserValidator } from '../validators/UserValidator';
import { Logger } from '../../../shared/utils/Logger';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { NotFoundError } from '../../../shared/errors/NotFoundError';

export class UserController {
    public router: Router;
    private userService: UserService;
    private validator: UserValidator;

    constructor(
        private authService: AuthenticationService,
        private logger: Logger
    ) {
        this.router = Router();
        this.userService = new UserService(authService.dbManager, authService.cache, logger);
        this.validator = new UserValidator();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Authentication routes
        this.router.post('/register', this.register.bind(this));
        this.router.post('/login', this.login.bind(this));
        this.router.post('/logout', this.authService.authenticate, this.logout.bind(this));
        this.router.post('/refresh-token', this.refreshToken.bind(this));
        
        // User management routes
        this.router.get('/profile', this.authService.authenticate, this.getProfile.bind(this));
        this.router.put('/profile', this.authService.authenticate, this.updateProfile.bind(this));
        this.router.delete('/profile', this.authService.authenticate, this.deleteProfile.bind(this));
        
        // Admin routes
        this.router.get('/users', this.authService.requireRole('admin'), this.getAllUsers.bind(this));
        this.router.get('/users/:id', this.authService.requireRole('admin'), this.getUserById.bind(this));
        this.router.put('/users/:id/role', this.authService.requireRole('admin'), this.updateUserRole.bind(this));
        this.router.delete('/users/:id', this.authService.requireRole('admin'), this.deleteUser.bind(this));
    }

    async register(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateRegistration(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const user = await this.userService.createUser(req.body);
            const tokens = await this.authService.generateTokens(user);

            this.logger.info(`User registered: ${user.email}`);
            
            res.status(201).json({
                success: true,
                data: {
                    user: this.userService.sanitizeUser(user),
                    tokens
                }
            });
        } catch (error) {
            this.logger.error('Registration error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async login(req: Request, res: Response): Promise<void> {
        try {
            const { email, password } = req.body;
            
            const validationResult = this.validator.validateLogin({ email, password });
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const user = await this.authService.validateCredentials(email, password);
            const tokens = await this.authService.generateTokens(user);

            this.logger.info(`User logged in: ${user.email}`);
            
            res.json({
                success: true,
                data: {
                    user: this.userService.sanitizeUser(user),
                    tokens
                }
            });
        } catch (error) {
            this.logger.error('Login error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid credentials'
            });
        }
    }

    async logout(req: Request, res: Response): Promise<void> {
        try {
            const token = req.headers.authorization?.replace('Bearer ', '');
            if (token) {
                await this.authService.revokeToken(token);
            }

            this.logger.info(`User logged out: ${req.user?.email}`);
            
            res.json({
                success: true,
                message: 'Logged out successfully'
            });
        } catch (error) {
            this.logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: 'Logout failed'
            });
        }
    }

    async refreshToken(req: Request, res: Response): Promise<void> {
        try {
            const { refreshToken } = req.body;
            
            if (!refreshToken) {
                throw new ValidationError('Refresh token is required');
            }

            const tokens = await this.authService.refreshTokens(refreshToken);
            
            res.json({
                success: true,
                data: { tokens }
            });
        } catch (error) {
            this.logger.error('Token refresh error:', error);
            res.status(401).json({
                success: false,
                error: 'Invalid refresh token'
            });
        }
    }

    async getProfile(req: Request, res: Response): Promise<void> {
        try {
            const user = await this.userService.getUserById(req.user.id);
            
            if (!user) {
                throw new NotFoundError('User not found');
            }

            res.json({
                success: true,
                data: { user: this.userService.sanitizeUser(user) }
            });
        } catch (error) {
            this.logger.error('Get profile error:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateProfile(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateProfileUpdate(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const updatedUser = await this.userService.updateUser(req.user.id, req.body);
            
            this.logger.info(`User profile updated: ${updatedUser.email}`);
            
            res.json({
                success: true,
                data: { user: this.userService.sanitizeUser(updatedUser) }
            });
        } catch (error) {
            this.logger.error('Update profile error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteProfile(req: Request, res: Response): Promise<void> {
        try {
            await this.userService.deleteUser(req.user.id);
            
            this.logger.info(`User profile deleted: ${req.user.email}`);
            
            res.json({
                success: true,
                message: 'Profile deleted successfully'
            });
        } catch (error) {
            this.logger.error('Delete profile error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete profile'
            });
        }
    }

    async getAllUsers(req: Request, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 10, search } = req.query;
            
            const users = await this.userService.getAllUsers({
                page: Number(page),
                limit: Number(limit),
                search: search as string
            });
            
            res.json({
                success: true,
                data: users
            });
        } catch (error) {
            this.logger.error('Get all users error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch users'
            });
        }
    }

    async getUserById(req: Request, res: Response): Promise<void> {
        try {
            const user = await this.userService.getUserById(req.params.id);
            
            if (!user) {
                throw new NotFoundError('User not found');
            }

            res.json({
                success: true,
                data: { user: this.userService.sanitizeUser(user) }
            });
        } catch (error) {
            this.logger.error('Get user by ID error:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateUserRole(req: Request, res: Response): Promise<void> {
        try {
            const { role } = req.body;
            
            if (!['user', 'admin', 'moderator'].includes(role)) {
                throw new ValidationError('Invalid role');
            }

            const updatedUser = await this.userService.updateUserRole(req.params.id, role);
            
            this.logger.info(`User role updated: ${updatedUser.email} -> ${role}`);
            
            res.json({
                success: true,
                data: { user: this.userService.sanitizeUser(updatedUser) }
            });
        } catch (error) {
            this.logger.error('Update user role error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteUser(req: Request, res: Response): Promise<void> {
        try {
            await this.userService.deleteUser(req.params.id);
            
            this.logger.info(`User deleted by admin: ${req.params.id}`);
            
            res.json({
                success: true,
                message: 'User deleted successfully'
            });
        } catch (error) {
            this.logger.error('Delete user error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete user'
            });
        }
    }
}