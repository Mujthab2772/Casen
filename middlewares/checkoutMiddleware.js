export const exitsCheckout = (req, res, next) => {
    try {
        if(!req.session.isCheckout) {
            return res.redirect('/cart')
        }

        next()
    } catch (error) {
        console.log(`error form exitsCheckout ${error}`);
        return res.redirect('/cart')
    }
}