import { productDetails } from "../../service/user/landingpageService.js"

export const landingPage = async (req, res) => {
    try {
        const result = await productDetails()

        res.render('landingPage', {products: result})
    } catch (error) {
        console.log(`error from landingPage ${error}`);
        
    }
}