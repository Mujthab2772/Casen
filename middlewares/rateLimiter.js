import rateLimit from "express-rate-limit";
import { STATUS_CODE } from "../util/statusCodes.js";


export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 min 
    max: 100, // limit to each ip max is 100 req
    message: {
        status: STATUS_CODE.BAD_REQUEST,
        message: "Too many requests from this IP, please try again after 15 minutes"
    },
    standardHeaders: true,
    legacyHeaders: false
})


export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: {
        status: STATUS_CODE.BAD_REQUEST,
        message: "Too many requests from this IP, please try again after 15 minutes"
    },
    handler: (req, res, next, options) => {
        if(req.headers.accept?.includes('text/html')) {
            req.session.loginErr = options.message.message
            return res.status(options.statusCode).redirect('/login')
        }
        res.status(options.statusCode).send(options.message)
    },
    standardHeaders: true,
    legacyHeaders: false
})