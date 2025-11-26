export const validateEmail = (email) => {
    try {
        const emailRegex = /^(?=.{5,}@)(?=[^@\s]*[a-zA-Z][^@\s]*@)[^@\s]+@[^@\s]+\.[^@\s]+$/
        return emailRegex.test(email)
    } catch (error) {
        console.log(`error from emailValidate ${error}`);        
    }
}

export const validatePassword = (password) => {
    try {
        const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/
        return passwordRegex.test(password)
    } catch (error) {
        console.log(`error from passvalidate ${error}`);        
    }
}


export const validatePhone = (phone) => {
    try {
        const phoneRegex = /^[6-9]\d{9}$/
        return phoneRegex.test(phone)
    } catch (error) {
        console.log(`error from phonevalidate ${error}`);        
    }
}

export const validateFirstName = (name) => {
    try {
        const nameRegex = /^[A-Za-z]{2,30}$/
        return nameRegex.test(name.trim())
    } catch (error) {
        console.log(`error from validatename ${error}`);        
    }
}

export const validateLastName = (name) => {
    try {
        const nameRegex = /^[A-Za-z]{1,30}$/;
        return nameRegex.test(name.trim())
    } catch (error) {
        console.log(`error from validateLastName ${error}`)
    }
}