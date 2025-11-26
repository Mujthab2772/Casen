import { validateEmail, validateFirstName, validateLastName, validatePassword, validatePhone } from "../util/validation.js";

export const validateSignUp = (req, res, next) => {
  // Check if it's an AJAX/JSON request
  const isJsonRequest = req.headers['content-type']?.includes('application/json');

  try {
    const { firstName, lastName, password, email, phone, confirmPassword } = req.body;

    const errors = {};

    if (!firstName || !validateFirstName(firstName)) {
      errors.firstName = "First name must contain only letters (2–30 chars)";
    }

    if (!lastName || !validateLastName(lastName)) {
      errors.lastName = "Last name must contain only letters (1–30 chars)";
    }

    if (!email || !validateEmail(email)) {
      errors.email = "Please enter a valid email address";
    }

    if (!phone || !validatePhone(phone)) {
      errors.phone = "Please enter a valid 10-digit phone number";
    }

    if (!password || !validatePassword(password)) {
      errors.password = "Password must be at least 8 characters with uppercase, lowercase, number, and special character";
    }

    if (password !== confirmPassword) {
      errors.confirmPassword = "Passwords do not match";
    }

    if (Object.keys(errors).length > 0) {
      if (isJsonRequest) {
        // Respond with JSON for AJAX requests
        return res.status(400).json({
          success: false,
          error: Object.values(errors)[0], // or send full errors object
          errors // optional: send all field errors
        });
      } else {
        // Traditional form post: render page with errors
        req.session.signUpErrFn = errors.firstName;
        req.session.signUpErrLn = errors.lastName;
        req.session.signUpErrEmail = errors.email;
        req.session.signUpErrPass = errors.password;
        req.session.signUpErrPhone = errors.phone;
        req.session.signUpErrPassConfirm = errors.confirmPassword;

        return res.render('signupPage', {
          errorFirstName: errors.firstName,
          errorLastName: errors.lastName,
          errorEmail: errors.email,
          errorPass: errors.password,
          errorPhone: errors.phone,
          errorConfirm: errors.confirmPassword
        });
      }
    }

    next();
  } catch (error) {
    console.log(`Error from validateSignUp: ${error}`);
    if (isJsonRequest) {
      return res.status(500).json({ success: false, error: 'Internal server error' });
    }
    res.redirect('/signUpPage');
  }
};

export const resetPasswordValidate = (req, res, next) => {
    try {
        req.session.newPassErr = null
        req.session.confirmPassErr = null
        const {resetPassword, confirmResetPass} = req.body

        const errors = {}

        if(resetPassword !== confirmResetPass) {
            errors.confirmPassErr = "The Password is not match"
        }

        if(!resetPassword || !validatePassword(resetPassword)) {
            errors.password = "Password must be at least 8 characters with uppercase, lowercase, number, and special character";
        }

        if(Object.keys(errors).length > 0) {
            req.session.newPassErr = errors.password 
            req.session.confirmPassErr = errors.confirmPassErr
            return res.render('resetPassword', {resetErr: req.session.newPassErr, confirmPassErr: req.session.confirmPassErr})
        }

        req.session.newPassErr = null
        req.session.confirmPassErr = null

        next()

    } catch (error) {
        console.log(`error from resetPasswordMiddleware ${error}`);
        res.redirect('/resetPasswordPage')
    }
}