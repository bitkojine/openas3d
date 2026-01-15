import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { DatabaseManager } from '../../../infrastructure/database/DatabaseManager';
import { RedisCache } from '../../../infrastructure/cache/RedisCache';
import { Logger } from '../../../shared/utils/Logger';
import { ConfigService } from '../../../shared/config/ConfigService';
import { UnauthorizedError } from '../../../shared/errors/UnauthorizedError';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { User } from '../models/User';
import { TokenPair } from '../types/TokenPair';

export class AuthenticationService {
    private config: ConfigService;

    constructor(
        public dbManager: DatabaseManager,
        public cache: RedisCache,
        private logger: Logger
    ) {
        this.config = new ConfigService();
    }

    async initialize(): Promise<void> {
        this.logger.info('Authentication service initialized');
    }

    async validateCredentials(email: string, password: string): Promise<User> {
        const user = await this.dbManager.users.findByEmail(email);
        
        if (!user) {
            throw new UnauthorizedError('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedError('Account is deactivated');
        }

        const isValidPassword = await bcrypt.compare(password, user.passwordHash);
        
        if (!isValidPassword) {
            // Log failed login attempt
            await this.logFailedLogin(email, 'invalid_password');
            throw new UnauthorizedError('Invalid credentials');
        }

        // Update last login
        await this.dbManager.users.updateLastLogin(user.id);
        
        this.logger.info(`Successful login: ${email}`);
        return user;
    }

    async generateTokens(user: User): Promise<TokenPair> {
        const payload = {
            userId: user.id,
            email: user.email,
            role: user.role,
            permissions: user.permissions
        };

        const accessToken = jwt.sign(
            payload,
            this.config.getJwtSecret(),
            { 
                expiresIn: this.config.getAccessTokenExpiry(),
                issuer: 'ecommerce-platform',
                audience: 'api'
            }
        );

        const refreshToken = jwt.sign(
            { userId: user.id },
            this.config.getRefreshTokenSecret(),
            { 
                expiresIn: this.config.getRefreshTokenExpiry(),
                issuer: 'ecommerce-platform'
            }
        );

        // Store refresh token in cache
        await this.cache.set(
            `refresh_token:${user.id}`,
            refreshToken,
            this.config.getRefreshTokenTtl()
        );

        return { accessToken, refreshToken };
    }

    async refreshTokens(refreshToken: string): Promise<TokenPair> {
        try {
            const decoded = jwt.verify(
                refreshToken,
                this.config.getRefreshTokenSecret()
            ) as any;

            // Check if refresh token exists in cache
            const cachedToken = await this.cache.get(`refresh_token:${decoded.userId}`);
            
            if (!cachedToken || cachedToken !== refreshToken) {
                throw new UnauthorizedError('Invalid refresh token');
            }

            const user = await this.dbManager.users.findById(decoded.userId);
            
            if (!user || !user.isActive) {
                throw new UnauthorizedError('User not found or inactive');
            }

            // Generate new token pair
            const tokens = await this.generateTokens(user);
            
            // Remove old refresh token
            await this.cache.delete(`refresh_token:${decoded.userId}`);
            
            return tokens;
        } catch (error) {
            this.logger.error('Token refresh failed:', error);
            throw new UnauthorizedError('Invalid refresh token');
        }
    }

    async revokeToken(token: string): Promise<void> {
        try {
            const decoded = jwt.decode(token) as any;
            
            if (decoded && decoded.userId) {
                // Add token to blacklist
                await this.cache.set(
                    `blacklisted_token:${token}`,
                    true,
                    decoded.exp - Math.floor(Date.now() / 1000)
                );
                
                // Remove refresh token
                await this.cache.delete(`refresh_token:${decoded.userId}`);
            }
        } catch (error) {
            this.logger.error('Token revocation failed:', error);
        }
    }

    async authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                throw new UnauthorizedError('No token provided');
            }

            const token = authHeader.substring(7);
            
            // Check if token is blacklisted
            const isBlacklisted = await this.cache.exists(`blacklisted_token:${token}`);
            
            if (isBlacklisted) {
                throw new UnauthorizedError('Token has been revoked');
            }

            const decoded = jwt.verify(token, this.config.getJwtSecret()) as any;
            
            // Verify user still exists and is active
            const user = await this.dbManager.users.findById(decoded.userId);
            
            if (!user || !user.isActive) {
                throw new UnauthorizedError('User not found or inactive');
            }

            // Add user to request object
            req.user = user;
            next();
        } catch (error) {
            if (error instanceof jwt.JsonWebTokenError) {
                res.status(401).json({
                    success: false,
                    error: 'Invalid token'
                });
            } else {
                res.status(401).json({
                    success: false,
                    error: error.message
                });
            }
        }
    }

    requireRole(requiredRole: string) {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                if (!req.user) {
                    throw new UnauthorizedError('Authentication required');
                }

                if (!this.hasRole(req.user, requiredRole)) {
                    throw new UnauthorizedError('Insufficient permissions');
                }

                next();
            } catch (error) {
                res.status(403).json({
                    success: false,
                    error: error.message
                });
            }
        };
    }

    requirePermission(permission: string) {
        return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
            try {
                if (!req.user) {
                    throw new UnauthorizedError('Authentication required');
                }

                if (!this.hasPermission(req.user, permission)) {
                    throw new UnauthorizedError('Insufficient permissions');
                }

                next();
            } catch (error) {
                res.status(403).json({
                    success: false,
                    error: error.message
                });
            }
        };
    }

    private hasRole(user: User, requiredRole: string): boolean {
        const roleHierarchy = {
            'user': 1,
            'moderator': 2,
            'admin': 3,
            'super_admin': 4
        };

        const userLevel = roleHierarchy[user.role] || 0;
        const requiredLevel = roleHierarchy[requiredRole] || 0;

        return userLevel >= requiredLevel;
    }

    private hasPermission(user: User, permission: string): boolean {
        return user.permissions.includes(permission) || user.role === 'admin';
    }

    private async logFailedLogin(email: string, reason: string): Promise<void> {
        try {
            const key = `failed_login:${email}`;
            const attempts = await this.cache.increment(key);
            
            if (attempts === 1) {
                await this.cache.expire(key, 900); // 15 minutes
            }

            if (attempts >= 5) {
                this.logger.warn(`Multiple failed login attempts for: ${email}`);
                // Could implement account lockout here
            }
        } catch (error) {
            this.logger.error('Failed to log failed login attempt:', error);
        }
    }

    async hashPassword(password: string): Promise<string> {
        const saltRounds = 12;
        return bcrypt.hash(password, saltRounds);
    }

    async validatePasswordStrength(password: string): Promise<boolean> {
        // Minimum 8 characters, at least one uppercase, lowercase, number, and special character
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/;
        return passwordRegex.test(password);
    }
}