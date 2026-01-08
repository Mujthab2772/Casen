export const wallet = async (req, res) => {
    try {
        res.render('wallet')
    } catch (error) {
        console.log(`error from wallet ${error}`);
        res.redirect('/profile')
    }
}