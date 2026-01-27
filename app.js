import express from "express"
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import dotenv from "dotenv";
import { connectDB } from "./config/dataBase.js";
import adminRouter from "./routes/adminRoute.js"
import userRouter from "./routes/userRoute.js";
import methodOverride from 'method-override'
import passport from './config/passport.js';
import flash from "connect-flash";
// import { generalLimiter } from "./middlewares/rateLimiter.js";
import morgan from "morgan";
import logger from "./util/logger.js";
import cors from 'cors'
import { callback } from "chart.js/helpers";

dotenv.config();
const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(methodOverride('_method'))
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set('view engine', "ejs")


app.use(express.static(path.join(__dirname, 'public/admin')))
app.use(express.static(path.join(__dirname, 'public/user')))


app.use(morgan(
    ':method :url :status :res[content-length] - :response-time ms',
    { stream: { write: (message) => logger.http(message.trim())}}
))
logger.info("Application starting up...")

const allowedOrigins = [
    'http://localhost:5000',
]

const corsOptions = {
    origin: (origin, callback) => {
        if(!origin) return callback(null, true);

        if(allowedOrigins.includes(origin)) {
            callback(null, true)
        }else {
            callback(new Error('Not allowed by CORS'))
        }
    },
    Credential: true,
    optionSuccessStatus: 200
}

app.use(cors(corsOptions))

app.use(session({
    secret: "Casen@2772",
    resave: false,
    saveUninitialized: false,
    // cookie: {
    //     maxAge: 1000 * 60 * 60 * 24
    // }
}))
// Flash middleware - MUST come after session
app.use(flash());

// Make flash messages and session available to all templates
app.use((req, res, next) => {
  res.locals.messages = req.flash();
  res.locals.session = req.session;
  next();
});

app.use(passport.initialize())
app.use(passport.session())

app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, must-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0')
    next()
})

const PORT = process.env.PORT

app.use("/admin", (req, res, next) => {
    app.set("views", path.join(__dirname, "views/admin"))
    next()
}, adminRouter)

app.use("/", (req, res, next) => {
    app.set("views", path.join(__dirname, "views/user"))
    next()
}, userRouter)



app.use("/", (req, res) => res.send("Not Found"))


app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`)
    connectDB()

})

