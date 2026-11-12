# Casen

Casen is a web-based e-commerce application built with **Node.js, Express, MongoDB, and EJS**. It provides a storefront for customers and a separate admin area for managing the store.

## Features

### Customer storefront
- User registration and login
- Email OTP verification and password reset
- Google OAuth authentication
- Product listing and product details
- Shopping cart and inventory checks
- Checkout and coupon handling
- Razorpay payment integration
- Order history, cancellation, and return requests
- Customer profile and address management
- Wishlist
- Wallet and referral features

### Admin dashboard
- Admin authentication
- Customer management and account blocking
- Product and category management
- Order and item status management
- Return request processing
- Coupon and offer management
- Dashboard and sales analytics
- Sales report export to PDF and Excel

## Tech stack

| Area | Technologies |
|---|---|
| Runtime | Node.js |
| Server | Express 5 |
| Database | MongoDB, Mongoose |
| Views | EJS |
| Authentication | Express Session, Passport.js, Google OAuth 2.0, bcrypt |
| Payments | Razorpay |
| File and image handling | Multer, Cloudinary |
| Email | Nodemailer |
| Reports | PDFKit, ExcelJS, Chart.js |
| Validation and security | express-validator, express-rate-limit, CSRF package |
| Logging | Morgan, Winston |

## Project structure

```text
Casen/
├── config/          # Database and authentication configuration
├── controllers/     # Admin and customer request handlers
├── middlewares/     # Authentication, validation, uploads and rate limits
├── models/          # Mongoose data models
├── public/
│   ├── admin/       # Admin static assets
│   └── user/        # Customer-facing static assets
├── routes/          # Admin and customer routes
├── service/         # Application service modules
├── util/            # Shared utilities and logging
├── views/
│   ├── admin/       # Admin EJS templates
│   └── user/        # Customer EJS templates
├── app.js           # Express application entry point
├── package.json
└── README.md
```

## Getting started

### Prerequisites

- Node.js and npm
- MongoDB database
- Google OAuth credentials (for Google sign-in)
- Razorpay account credentials (for payment processing)
- Cloudinary account credentials (if using image uploads)
- SMTP credentials (for email delivery)

### 1. Clone the repository

```bash
git clone https://github.com/Mujthab2772/Casen.git
cd Casen
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root. Add the values required by your local configuration:

```env
PORT=5000
MONGODB_URL=

GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_CALLBACK_URL=

# Add the Razorpay, Cloudinary and SMTP credentials
# referenced by your application configuration.
```

Keep real credentials out of version control. The exact environment variable names for payment, image upload, and email settings should match the corresponding service/configuration files in your local project.

### 4. Start the application

The current `package.json` does not define a start or development script. You can run the application directly:

```bash
node app.js
```

Open the local URL printed by the server after startup. The application mounts the admin area under `/admin`; customer-facing routes are mounted at the root path `/`.

## Configuration notes

- The application connects to MongoDB using `MONGODB_URL`.
- The allowed browser origins are currently configured in `app.js`. Update the `allowedOrigins` list when using a different local or deployed domain.
- Google OAuth requires a callback URL registered in the Google Cloud project and matching `GOOGLE_CALLBACK_URL`.
- Configure payment, email, and Cloudinary credentials before testing those integrations.

## Development status

This README documents the application structure and capabilities visible in the repository. Some setup details depend on environment-specific credentials and configuration.

## License

The project currently declares the **ISC** license in `package.json`.
