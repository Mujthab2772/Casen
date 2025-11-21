import { productDetails, userDetail } from "../../service/user/landingpageService.js"

export const landingPage = async (req, res) => {
    try {
        let user = null
        if(req.session.userEmail) {
            const email = req.session.userEmail
            user = await userDetail(email) 
            req.session.userDetail = user
        }
        const result = await productDetails()

        res.render('landingPage', {products: result, user})
    } catch (error) {
        console.log(`error from landingPage ${error}`);
        
    }
}


export const logout = async (req, res) => {
    try {
        req.session.destroy(err => {
            if(err) {
                return res.send("Error Logging out")
            }
            res.clearCookie("connect.sid")
            res.redirect('/')
        })
    } catch (error) {
        console.log(`error from logot user ${error}`);
    }
}
