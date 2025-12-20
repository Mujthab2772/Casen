// middleware/couponValidation.js
import { body, validationResult } from 'express-validator';

export const validateCoupon = [
  body('couponCode')
    .trim()
    .isLength({ min: 3, max: 20 }).withMessage('Coupon code must be 3–20 uppercase letters/numbers/underscores')
    .matches(/^[A-Z0-9_]+$/).withMessage('Invalid coupon code format'),

  body('discountType')
    .isIn(['fixed', 'percentage']).withMessage('Invalid discount type'),

  body('discountAmount')
    .isFloat({ gt: 0 }).withMessage('Discount amount must be > 0')
    .custom((value, { req }) => {
      if (req.body.discountType === 'percentage' && (value < 1 || value > 100)) {
        throw new Error('Percentage must be between 1 and 100');
      }
      return true;
    }),

  body('startDate')
    .isISO8601().withMessage('Invalid start date'),

  body('endDate')
    .isISO8601().withMessage('Invalid end date')
    .custom((value, { req }) => {
      const start = new Date(req.body.startDate);
      const end = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (start > end) throw new Error('Start date must be before end date');
      if (end < today) throw new Error('End date cannot be in the past');
      return true;
    }),

  body('minAmount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ gt: 0 }).withMessage('Min purchase must be > 0'),

  body('maxAmount')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ gt: 0 }).withMessage('Max discount must be > 0'),

  body('perUserLimit')
    .isInt({ min: 1 }).withMessage('Usage limit must be at least 1'),
];

export function handleValidationErrors(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg
    });
  }
  next();
}