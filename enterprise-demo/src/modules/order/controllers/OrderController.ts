import { Router, Request, Response } from 'express';
import { DatabaseManager } from '../../../infrastructure/database/DatabaseManager';
import { InventoryService } from '../../inventory/services/InventoryService';
import { NotificationService } from '../../notification/services/NotificationService';
import { AnalyticsService } from '../../analytics/services/AnalyticsService';
import { Logger } from '../../../shared/utils/Logger';
import { OrderService } from '../services/OrderService';
import { OrderValidator } from '../validators/OrderValidator';
import { PaymentService } from '../../payment/services/PaymentService';
import { ShippingService } from '../services/ShippingService';
import { ValidationError } from '../../../shared/errors/ValidationError';
import { NotFoundError } from '../../../shared/errors/NotFoundError';

export class OrderController {
    public router: Router;
    private orderService: OrderService;
    private paymentService: PaymentService;
    private shippingService: ShippingService;
    private validator: OrderValidator;

    constructor(
        private dbManager: DatabaseManager,
        private inventoryService: InventoryService,
        private notificationService: NotificationService,
        private analyticsService: AnalyticsService,
        private logger: Logger
    ) {
        this.router = Router();
        this.orderService = new OrderService(dbManager, inventoryService, logger);
        this.paymentService = new PaymentService(dbManager, notificationService, logger);
        this.shippingService = new ShippingService(dbManager, logger);
        this.validator = new OrderValidator();
        this.setupRoutes();
    }

    private setupRoutes(): void {
        // Customer order routes
        this.router.post('/orders', this.createOrder.bind(this));
        this.router.get('/orders', this.getUserOrders.bind(this));
        this.router.get('/orders/:id', this.getOrderById.bind(this));
        this.router.put('/orders/:id/cancel', this.cancelOrder.bind(this));
        this.router.get('/orders/:id/tracking', this.getOrderTracking.bind(this));
        
        // Admin order management
        this.router.get('/admin/orders', this.getAllOrders.bind(this));
        this.router.put('/admin/orders/:id/status', this.updateOrderStatus.bind(this));
        this.router.put('/admin/orders/:id/shipping', this.updateShippingInfo.bind(this));
        this.router.post('/admin/orders/:id/refund', this.processRefund.bind(this));
        
        // Order analytics
        this.router.get('/admin/orders/analytics/summary', this.getOrderAnalytics.bind(this));
        this.router.get('/admin/orders/analytics/revenue', this.getRevenueAnalytics.bind(this));
    }

    async createOrder(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateOrder(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            // Check inventory availability
            const inventoryCheck = await this.inventoryService.checkAvailability(req.body.items);
            if (!inventoryCheck.available) {
                throw new ValidationError(`Insufficient inventory: ${inventoryCheck.unavailableItems.join(', ')}`);
            }

            // Create order
            const order = await this.orderService.createOrder(req.user.id, req.body);

            // Reserve inventory
            await this.inventoryService.reserveItems(order.id, req.body.items);

            // Process payment
            const paymentResult = await this.paymentService.processPayment(
                order.id,
                req.body.paymentMethod,
                order.totalAmount
            );

            if (!paymentResult.success) {
                // Release reserved inventory
                await this.inventoryService.releaseReservation(order.id);
                throw new ValidationError('Payment processing failed');
            }

            // Update order status
            await this.orderService.updateOrderStatus(order.id, 'confirmed');

            // Send confirmation notification
            await this.notificationService.sendOrderConfirmation(req.user.id, order);

            // Track analytics
            await this.analyticsService.trackOrderCreated(order);

            this.logger.info(`Order created: ${order.id} for user: ${req.user.id}`);

            res.status(201).json({
                success: true,
                data: { order }
            });
        } catch (error) {
            this.logger.error('Create order error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getUserOrders(req: Request, res: Response): Promise<void> {
        try {
            const { page = 1, limit = 10, status } = req.query;

            const orders = await this.orderService.getUserOrders(req.user.id, {
                page: Number(page),
                limit: Number(limit),
                status: status as string
            });

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            this.logger.error('Get user orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders'
            });
        }
    }

    async getOrderById(req: Request, res: Response): Promise<void> {
        try {
            const order = await this.orderService.getOrderById(req.params.id);

            if (!order) {
                throw new NotFoundError('Order not found');
            }

            // Verify user owns the order or is admin
            if (order.userId !== req.user.id && req.user.role !== 'admin') {
                throw new NotFoundError('Order not found');
            }

            res.json({
                success: true,
                data: { order }
            });
        } catch (error) {
            this.logger.error('Get order by ID error:', error);
            res.status(404).json({
                success: false,
                error: error.message
            });
        }
    }

    async cancelOrder(req: Request, res: Response): Promise<void> {
        try {
            const order = await this.orderService.getOrderById(req.params.id);

            if (!order) {
                throw new NotFoundError('Order not found');
            }

            if (order.userId !== req.user.id) {
                throw new NotFoundError('Order not found');
            }

            if (!['pending', 'confirmed'].includes(order.status)) {
                throw new ValidationError('Order cannot be cancelled');
            }

            // Cancel order
            await this.orderService.cancelOrder(order.id, 'customer_request');

            // Process refund if payment was made
            if (order.paymentStatus === 'completed') {
                await this.paymentService.processRefund(order.id, order.totalAmount);
            }

            // Release inventory
            await this.inventoryService.releaseReservation(order.id);

            // Send cancellation notification
            await this.notificationService.sendOrderCancellation(req.user.id, order);

            this.logger.info(`Order cancelled: ${order.id}`);

            res.json({
                success: true,
                message: 'Order cancelled successfully'
            });
        } catch (error) {
            this.logger.error('Cancel order error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getAllOrders(req: Request, res: Response): Promise<void> {
        try {
            const {
                page = 1,
                limit = 20,
                status,
                startDate,
                endDate,
                search
            } = req.query;

            const filters = {
                status: status as string,
                startDate: startDate as string,
                endDate: endDate as string,
                search: search as string
            };

            const orders = await this.orderService.getAllOrders({
                page: Number(page),
                limit: Number(limit),
                filters
            });

            res.json({
                success: true,
                data: orders
            });
        } catch (error) {
            this.logger.error('Get all orders error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch orders'
            });
        }
    }

    async updateOrderStatus(req: Request, res: Response): Promise<void> {
        try {
            const { status, notes } = req.body;

            const validStatuses = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
            if (!validStatuses.includes(status)) {
                throw new ValidationError('Invalid order status');
            }

            const order = await this.orderService.updateOrderStatus(req.params.id, status, notes);

            // Handle status-specific logic
            if (status === 'shipped') {
                await this.shippingService.createShipment(order.id);
                await this.notificationService.sendShippingNotification(order.userId, order);
            } else if (status === 'delivered') {
                await this.analyticsService.trackOrderDelivered(order);
            }

            this.logger.info(`Order status updated: ${order.id} -> ${status}`);

            res.json({
                success: true,
                data: { order }
            });
        } catch (error) {
            this.logger.error('Update order status error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getOrderTracking(req: Request, res: Response): Promise<void> {
        try {
            const tracking = await this.shippingService.getTrackingInfo(req.params.id);

            res.json({
                success: true,
                data: { tracking }
            });
        } catch (error) {
            this.logger.error('Get order tracking error:', error);
            res.status(404).json({
                success: false,
                error: 'Tracking information not found'
            });
        }
    }

    async updateShippingInfo(req: Request, res: Response): Promise<void> {
        try {
            const validationResult = this.validator.validateShippingUpdate(req.body);
            if (!validationResult.isValid) {
                throw new ValidationError(validationResult.errors.join(', '));
            }

            const shipping = await this.shippingService.updateShippingInfo(req.params.id, req.body);

            this.logger.info(`Shipping info updated for order: ${req.params.id}`);

            res.json({
                success: true,
                data: { shipping }
            });
        } catch (error) {
            this.logger.error('Update shipping info error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async processRefund(req: Request, res: Response): Promise<void> {
        try {
            const { amount, reason } = req.body;

            const refund = await this.paymentService.processRefund(
                req.params.id,
                amount,
                reason
            );

            // Update order status
            await this.orderService.updateOrderStatus(req.params.id, 'refunded');

            // Send refund notification
            const order = await this.orderService.getOrderById(req.params.id);
            await this.notificationService.sendRefundNotification(order.userId, order, refund);

            this.logger.info(`Refund processed for order: ${req.params.id}`);

            res.json({
                success: true,
                data: { refund }
            });
        } catch (error) {
            this.logger.error('Process refund error:', error);
            res.status(400).json({
                success: false,
                error: error.message
            });
        }
    }

    async getOrderAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const { startDate, endDate } = req.query;

            const analytics = await this.analyticsService.getOrderAnalytics({
                startDate: startDate as string,
                endDate: endDate as string
            });

            res.json({
                success: true,
                data: analytics
            });
        } catch (error) {
            this.logger.error('Get order analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch analytics'
            });
        }
    }

    async getRevenueAnalytics(req: Request, res: Response): Promise<void> {
        try {
            const { period = 'month', startDate, endDate } = req.query;

            const revenue = await this.analyticsService.getRevenueAnalytics({
                period: period as string,
                startDate: startDate as string,
                endDate: endDate as string
            });

            res.json({
                success: true,
                data: revenue
            });
        } catch (error) {
            this.logger.error('Get revenue analytics error:', error);
            res.status(500).json({
                success: false,
                error: 'Failed to fetch revenue analytics'
            });
        }
    }
}