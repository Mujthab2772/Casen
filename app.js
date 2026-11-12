import "dotenv/config";
import express from "express";
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import { connectDB } from "./config/dataBase.js";
import adminRouter from "./routes/adminRoute.js";
import userRouter from "./routes/userRoute.js";
import methodOverride from "method-override";
import passport from "./config/passport.js";
import flash from "connect-flash";
import morgan from "morgan";
import logger from "./util/logger.js";
import cors from "cors";

const app = express();
const isProduction = process.env.NODE_ENV === "production";
const PORT = Number(process.env.PORT) || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

if (isProduction) {
  app.set("trust proxy", 1);
}

app.use(methodOverride("_method"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public/admin")));
app.use(express.static(path.join(__dirname, "public/user")));

app.use(
  morgan(":method :url :status :res[content-length] - :response-time ms", {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
  })
);

logger.info("Application starting up...");

// CORS origins are exact browser origins, including scheme and optional port.
// Keep the existing local and legacy domains, and allow the deployed app itself.
// Add any separately hosted browser frontend through the CORS_ORIGINS env var.
const defaultAllowedOrigins = [
  "http://localhost:5000",
  "https://mujthab.xyz",
  "https://www.mujthab.xyz",
  "https://casen.onrender.com",
];

const configuredAllowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  ...defaultAllowedOrigins,
  ...configuredAllowedOrigins,
]);

const corsOptions = {
  origin: (origin, callback) => {
    // Requests without an Origin header (health checks, curl, server-to-server)
    // are not browser CORS requests and can proceed.
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`Origin not allowed by CORS: ${origin}`));
  },
  credentials: true,
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 204,
};

app.use(cors(corsOptions));

const sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
  throw new Error("SESSION_SECRET is required. Configure it in the deployment environment.");
}

app.use(
  session({
    name: "casen.sid",
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    proxy: isProduction,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
    },
  })
);

// Flash middleware must come after session.
app.use(flash());

app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.session = req.session;
  next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use((req, res, next) => {
  res.set("Cache-Control", "no-store, no-cache, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
  next();
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

app.use(
  "/admin",
  (req, res, next) => {
    app.set("views", path.join(__dirname, "views/admin"));
    next();
  },
  adminRouter
);

app.use(
  "/",
  (req, res, next) => {
    app.set("views", path.join(__dirname, "views/user"));
    next();
  },
  userRouter
);

app.use("/", (_req, res) => res.redirect("/NotFound"));

const startServer = async () => {
  await connectDB();

  const server = app.listen(PORT, () => {
    logger.info(`Casen is listening on port ${PORT}`);
  });

  server.on("error", (error) => {
    logger.error(`HTTP server failed: ${error.message}`);
    process.exit(1);
  });
};

startServer().catch((error) => {
  logger.error(`Application startup failed: ${error.message}`);
  process.exit(1);
});
