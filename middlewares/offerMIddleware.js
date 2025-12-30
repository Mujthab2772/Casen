import { body, validationResult } from 'express-validator';

const isValidObjectId = (value) => {
  return /^[0-9a-fA-F]{24}$/.test(value);
};

// Helper: Normalize a date string to UTC midnight for date-only comparison
const normalizeDate = (dateStr) => {
  const d = new Date(dateStr);
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
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
      const todayUTC = normalizeDate(new Date());
      const startUTC = normalizeDate(value);
      if (startUTC < todayUTC) {
        throw new Error('Start date cannot be in the past');
      }
      return true;
    }),
  
  body('endDate')
    .notEmpty().withMessage('End date is required')
    .isISO8601().withMessage('Invalid end date')
    .custom((value, { req }) => {
      const startUTC = normalizeDate(req.body.startDate);
      const endUTC = normalizeDate(value);
      if (endUTC <= startUTC) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  
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
  
  // Final error handler
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