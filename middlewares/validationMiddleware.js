import { validateEmail, validateFirstName, validateLastName, validatePassword, validatePhone } from "../util/validation.js";

export const validateSignUp = (req, res, next) => {
    try {
        req.session.signUpErrFn = null
        req.session.signUpErrLn = null
        req.session.signUpErrEmail = null
        req.session.signUpErrPass  = null
        req.session.signUpErrPhone = null
        req.session.signUpErrPassConfirm = null
       const {firstName, lastName, password, email, phone} = req.body

       const errors = {}

       if(!firstName || !validateFirstName(firstName)) {
        errors.firstName = "First name must contain only letters (2–30 chars)"
       }

       if(!lastName || !validateLastName(lastName)) {
        errors.lastName = "Last name must contain only letters (1–30 chars)";
       }

       if(!email || !validateEmail(email)) {
        errors.email = "Please enter a valid email address"
       }

       if(!password || !validatePassword(password)) {
        errors.password = "Password must be at least 8 characters with uppercase, lowercase, number, and special character";
       }

       if(!phone || !validatePhone(phone)) {
        errors.phone = "Please enter a valid 10-digit phone number"
       }

       if(Object.keys(errors).length > 0) {
        req.session.signUpErrFn = errors.firstName
        req.session.signUpErrLn = errors.lastName
        req.session.signUpErrEmail = errors.email   
        req.session.signUpErrPass  = errors.password
        req.session.signUpErrPhone = errors.phone

        return res.render('signupPage', {errorFirstName: req.session.signUpErrFn, errorLastName: req.session.signUpErrLn, errorEmail: req.session.signUpErrEmail, errorPass: req.session.signUpErrPass, errorPhone: req.session.signUpErrPhone, errorConfirm: null})
       }

       next()
    } catch (error) {
        console.log(`error from validatesignUp ${error}`); 
        res.redirect('/user/signUpPage')       
    }
}