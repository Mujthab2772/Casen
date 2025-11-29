// middlewares/addressValidation.js
import { body, validationResult } from 'express-validator';

export const validateAddress = [
body('fullName')
  .trim()
  .notEmpty().withMessage('Full name is required.')
  .matches(/^[A-Za-z\s\-']+$/).withMessage('Full name can only contain letters, spaces, hyphens, and apostrophes.')
  .isLength({ max: 100 }).withMessage('Full name must be under 100 characters.'),

body('streetAddress')
  .trim()
  .notEmpty().withMessage('Street address is required.')
  .matches(/^[A-Za-z0-9\s,.'\-/#]+$/).withMessage('Street address contains invalid characters.')
  .isLength({ max: 200 }).withMessage('Street address must be under 200 characters.'),

  body('mobile')
    .trim()
    .notEmpty().withMessage('Phone number is required.')
    .matches(/^(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/)
    .withMessage('Please enter a valid phone number.'),

  body('city')
    .trim()
    .notEmpty().withMessage('City is required.')
    .matches(/^[A-Za-z\s\-']+$/)
    .withMessage('City must contain only letters, spaces, hyphens, or apostrophes.')
    .isLength({ max: 50 }).withMessage('City name is too long.'),

  body('state')
    .trim()
    .notEmpty().withMessage('State/Province is required.')
    .matches(/^[A-Za-z\s\-']+$/)
    .withMessage('State must contain only letters, spaces, hyphens, or apostrophes.')
    .isLength({ max: 50 }).withMessage('State name is too long.'),

  body('postalcode')
    .trim()
    .notEmpty().withMessage('Postal code is required.')
    .matches(/^[A-Za-z0-9\s\-]{3,10}$/)
    .withMessage('Please enter a valid postal code.'),

  body('country')
    .notEmpty().withMessage('Country is required.'),


// In validateAddress middleware, replace the redirect with:
(req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      ok: false,
      errors: errors.array() // ✅ GOOD – includes .path, .msg, etc.
    });
  }
  next();
}
];