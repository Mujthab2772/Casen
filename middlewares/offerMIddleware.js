// middleware/offerValidation.js
import { body, validationResult } from 'express-validator';

const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

export const validateOfferCreation = [
  body('offerName')
    .trim()
    .notEmpty().withMessage('Offer name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Offer name must be 2–100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]+$/).withMessage('Offer name can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('offerType')
    .isIn(['percentage', 'fixed', 'buyonegetone', 'free_shipping'])
    .withMessage('Invalid offer type'),

  body('discountValue')
    .notEmpty().withMessage('Discount value is required')
    .isFloat({ gt: 0 }).withMessage('Discount must be greater than 0')
    .custom((value, { req }) => {
      if (req.body.offerType === 'percentage' && value > 100) {
        throw new Error('Percentage discount cannot exceed 100');
      }
      return true;
    }),

  body('startDate')
    .notEmpty().withMessage('Start date is required')
    .isISO8601().withMessage('Invalid start date')
    .custom((value) => {
      if (new Date(value) < new Date()) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),

  body('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.body.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),

  body('minPurchase')
    .optional({ nullable: true, checkFalsy: true })
    .isFloat({ min: 0 }).withMessage('Minimum purchase cannot be negative'),

  body('status')
    .optional()
    .isIn(['active', 'inactive']).withMessage('Invalid status'),

  body('applicableType')
    .notEmpty().withMessage('Applicability type is required')
    .isIn(['all', 'products', 'categories']).withMessage('Invalid applicability type'),

  // ✅ Robust product validation
  body('selectedProducts')
    .custom((value, { req }) => {
      if (req.body.applicableType === 'products') {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('At least one product must be selected');
        }
        for (const id of value) {
          if (typeof id !== 'string' || !isValidObjectId(id)) {
            throw new Error('Invalid product ID format');
          }
        }
      }
      // If not 'products', we don't care what's in selectedProducts (can be [], undefined, etc.)
      return true;
    }),

  // ✅ Robust category validation
  body('selectedCategories')
    .custom((value, { req }) => {
      if (req.body.applicableType === 'categories') {
        if (!Array.isArray(value) || value.length === 0) {
          throw new Error('At least one category must be selected');
        }
        for (const id of value) {
          if (typeof id !== 'string' || !isValidObjectId(id)) {
            throw new Error('Invalid category ID format');
          }
        }
      }
      return true;
    }),

  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array().map(err => ({
          path: err.param,
          msg: err.msg
        }))
      });
    }
    next();
  }
];