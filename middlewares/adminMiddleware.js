export const adminCheck = async (req, res, next) => {
    try {
        if (req.session.adminUsr) {
            return next()
        }
        res.redirect('/admin/login')
    } catch (error) {
        console.log(`error from adminCheck ${error}`);
    }
}

export const adminCheckLogin = async (req, res, next) => {
    try {
        if(!req.session.adminUsr){
            return next()
        }
        res.redirect('/admin/products')
    } catch (error) {
        
    }
}