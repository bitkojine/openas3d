import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../../../infrastructure/database/DatabaseManager';
import { RedisCache } from '../../../infrastructure/cache/RedisCache';
import { Logger } from '../../../shared/utils/Logger';
import { ProductService } from '../services/ProductService';
import { ProductValidator } from '../validators/ProductValidator';
import { InventoryService } from '../../inventory/services/InventoryService';
import { SearchService } from '../services/SearchService';
import { ImageUploadService } from '../services/ImageUploadService';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { NotFoundError } from '../../../shared/errors/NotFoundError';

export class ProductController {
    public router: Router;
    private productService: ProductService;
    private inventoryService: InventoryService;
    private searchService: SearchService;
    private imageUploadService: ImageUploadService;
    private validator: ProductValidator;

    constructor(
        private dbManager: DatabaseManager,
        private cache: RedisCache,
        private logger: Logger
    ) {
        this.router = Router();
        this.productService = new ProductService(dbManager, cache, logger);
        this.inventoryService = new InventoryService(dbManager, cache, logger);
        this.searchService = new SearchService(cache, logger);
        this.imageUploadService = new ImageUploadService(logger);
        this.validator = new ProductValidator();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Public product routes
        this.router.get('/products', this.getProducts.bind(this));
        this.router.get('/products/search', this.searchProducts.bind(this));
        this.router.get('/products/categories', this.getCategories.bind(this));
        this.router.get('/products/featured', this.getFeaturedProducts.bind(this));
        this.router.get('/products/:id', this.getProductById.bind(this));
        this.router.get('/products/:id/reviews', this.getProductReviews.bind(this));
        this.router.get('/products/:id/related', this.getRelatedProducts.bind(this));
        
        // Authenticated user routes
        this.router.post('/products/:id/reviews', this.createReview.bind(this));
        this.router.put('/products/:id/reviews/:reviewId', this.updateReview.bind(this));
        this.router.delete('/products/:id/reviews/:reviewId', this.deleteReview.bind(this));
        this.router.post('/products/:id/wishlist', this.addToWishlist.bind(this));
        this.router.delete('/products/:id/wishlist', this.removeFromWishlist.bind(this));
        
        // Admin routes
        this.router.post('/products', this.createProduct.bind(this));
        this.router.put('/products/:id', this.updateProduct.bind(this));
        this.router.delete('/products/:id', this.deleteProduct.bind(this));
        this.router.post('/products/:id/images', this.uploadProductImages.bind(this));
        this.router.delete('/products/:id/images/:imageId', this.deleteProductImage.bind(this));
        this.router.put('/products/:id/inventory', this.updateInventory.bind(this));
        this.router.post('/products/bulk-import', this.bulkImportProducts.bind(this));
    }

    async getProducts(req: Request, res: Response): Promise<void> {
        try {
            const {
                page = 1,
                limit = 20,
                category,
                minPrice,
                maxPrice,
                sortBy = 'createdAt',
                sortOrder = 'desc',
                inStock = true
            } = req.query;

            const filters = {
                category: category as string,
                minPrice: minPrice ? Number(minPrice) : undefined,
                maxPrice: maxPrice ? Number(maxPrice) : undefined,
                inStock: inStock === 'true'
            };

            const products = await this.productService.getProducts({
                page: Number(page),
                limit: Number(limit),
                filters,
                sortBy: sortBy as string,
                sortOrder: sortOrder as 'asc' | 'desc'
            });

            res.json({
                success: true,
                data: products
            });
        } catch (error) {
            this.logger.error('Get products error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch products'
            });
        }
    }

    async searchProducts(req: Request, res: Response): Promise<void> {
        try {
            const { q: query, page = 1, limit = 20 } = req.query;

            if (!query) {
                throw new ValidationError('Search query is required');
            }

            const results = await this.searchService.searchProducts(
                query as string,
                {
                    page: Number(page),
                    limit: Number(limit)
                }
            );

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            this.logger.error('Search products error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getProductById(req: Request, res: Response): Promise<void> {
        try {
            const product = await this.productService.getProductById(req.params.id);

            if (!product) {
                throw new NotFoundError('Product not found');
            }

            // Increment view count
            await this.productService.incrementViewCount(product.id);

            res.json({
                success: true,
                data: { product }
            });
        } catch (error) {
            this.logger.error('Get product by ID error:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    async createProduct(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateProduct(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const product = await this.productService.createProduct(req.body);

            // Initialize inventory
            await this.inventoryService.initializeProductInventory(
                product.id,
                req.body.initialStock || 0
            );

            this.logger.info(`Product created: ${product.name} (${product.id})`);

            res.status(201).json({
                success: true,
                data: { product }
            });
        } catch (error) {
            this.logger.error('Create product error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateProduct(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateProductUpdate(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const product = await this.productService.updateProduct(req.params.id, req.body);

            this.logger.info(`Product updated: ${product.name} (${product.id})`);

            res.json({
                success: true,
                data: { product }
            });
        } catch (error) {
            this.logger.error('Update product error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async deleteProduct(req: Request, res: Response): Promise<void> {
        try {
            await this.productService.deleteProduct(req.params.id);

            this.logger.info(`Product deleted: ${req.params.id}`);

            res.json({
                success: true,
                message: 'Product deleted successfully'
            });
        } catch (error) {
            this.logger.error('Delete product error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to delete product'
            });
        }
    }

    async getCategories(req: Request, res: Response): Promise<void> {
        try {
            const categories = await this.productService.getCategories();

            res.json({
                success: true,
                data: { categories }
            });
        } catch (error) {
            this.logger.error('Get categories error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch categories'
            });
        }
    }

    async getFeaturedProducts(req: Request, res: Response): Promise<void> {
        try {
            const { limit = 10 } = req.query;

            const products = await this.productService.getFeaturedProducts(Number(limit));

            res.json({
                success: true,
                data: { products }
            });
        } catch (error) {
            this.logger.error('Get featured products error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch featured products'
            });
        }
    }

    async getRelatedProducts(req: Request, res: Response): Promise<void> {
        try {
            const { limit = 5 } = req.query;

            const products = await this.productService.getRelatedProducts(
                req.params.id,
                Number(limit)
            );

            res.json({
                success: true,
                data: { products }
            });
        } catch (error) {
            this.logger.error('Get related products error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch related products'
            });
        }
    }

    async uploadProductImages(req: Request, res: Response): Promise<void> {
        try {
            const images = await this.imageUploadService.uploadProductImages(
                req.params.id,
                req.files
            );

            await this.productService.addProductImages(req.params.id, images);

            this.logger.info(`Images uploaded for product: ${req.params.id}`);

            res.json({
                success: true,
                data: { images }
            });
        } catch (error) {
            this.logger.error('Upload product images error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async createReview(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateReview(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const review = await this.productService.createReview(
                req.params.id,
                req.user.id,
                req.body
            );

            this.logger.info(`Review created for product: ${req.params.id}`);

            res.status(201).json({
                success: true,
                data: { review }
            });
        } catch (error) {
            this.logger.error('Create review error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async updateInventory(req: Request, res: Response): Promise<void> {
        try {
            const { quantity, operation = 'set' } = req.body;

            if (typeof quantity !== 'number') {
                throw new ValidationError('Quantity must be a number');
            }

            const inventory = await this.inventoryService.updateInventory(
                req.params.id,
                quantity,
                operation as 'set' | 'add' | 'subtract'
            );

            this.logger.info(`Inventory updated for product: ${req.params.id}`);

            res.json({
                success: true,
                data: { inventory }
            });
        } catch (error) {
            this.logger.error('Update inventory error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async bulkImportProducts(req: Request, res: Response): Promise<void> {
        try {
            const { products } = req.body;

            if (!Array.isArray(products)) {
                throw new ValidationError('Products must be an array');
            }

            const results = await this.productService.bulkImportProducts(products);

            this.logger.info(`Bulk import completed: ${results.successful} successful, ${results.failed} failed`);

            res.json({
                success: true,
                data: results
            });
        } catch (error) {
            this.logger.error('Bulk import error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getProductReviews(req: Request, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 10 } = req.query;

            const reviews = await this.productService.getProductReviews(
                req.params.id,
                {
                    page: Number(page),
                    limit: Number(limit)
                }
            );

            res.json({
                success: true,
                data: reviews
            });
        } catch (error) {
            this.logger.error('Get product reviews error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch reviews'
            });
        }
    }

    async addToWishlist(req: Request, res: Response): Promise<void> {
        try {
            await this.productService.addToWishlist(req.user.id, req.params.id);

            res.json({
                success: true,
                message: 'Product added to wishlist'
            });
        } catch (error) {
            this.logger.error('Add to wishlist error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async removeFromWishlist(req: Request, res: Response): Promise<void> {
        try {
            await this.productService.removeFromWishlist(req.user.id, req.params.id);

            res.json({
                success: true,
                message: 'Product removed from wishlist'
            });
        } catch (error) {
            this.logger.error('Remove from wishlist error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }
}