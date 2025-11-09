import express from "express"
import path, { dirname } from "path";
import { fileURLToPath } from "url";
import session from "express-session";
import dotenv from "dotenv";
import { connectDB } from "./config/dataBase.js";
import adminRouter from "./routes/adminRoute.js"
import userRouter from "./routes/userRoute.js";
import methodOverride from 'method-override'

dotenv.config();
const app = express()

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.set('view engine', "ejs")


app.use(express.static(path.join(__dirname, 'public/admin')))
app.use(express.static(path.join(__dirname, 'public/user')))
app.use(methodOverride('_method'))

app.use(session({
    secret: "loginPageAndSignUp460",
    resave: false,
    saveUninitialized: false,
    // cookie: {
    //     maxAge: 1000 * 60 * 60 * 24
    // }
}))

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

app.use("/user", (req, res, next) => {
    app.set("views", path.join(__dirname, "views/user"))
    next()
}, userRouter)



app.use("/", (req, res) => res.send("Not Found"))


app.listen(PORT, () => {
    console.log(`http://localhost:${PORT}`)
    connectDB()

})

