import { uploadToCloudinary } from "../../util/cloudinaryUpload.js";
import userCollection from "../../models/userModel.js";
import { otpPage } from "../../controllers/user/signupController.js";

export const profileUpdate = async (profileDetails, image, user, req) => {
    try {
        const { firstName, lastName, email, phoneNumber } = profileDetails
        const userDetail = await userCollection.findById({_id: user._id})

        if (userDetail.email !== email) {
            
        }

        let imageUrl = null
        if(image) {
            imageUrl = await uploadToCloudinary(image.path, "profile-photo")
        }

        if(!userDetail) return 'User not found'

        userDetail.firstName = firstName || userDetail.firstName
        userDetail.lastName = lastName || userDetail.lastName
        userDetail.email = email || userDetail.email
        userDetail.profilePic = (imageUrl) ? imageUrl : userDetail.profilePic
        userDetail.phoneNumber = phoneNumber || userDetail.phoneNumber

        await userDetail.save()
        return userDetail
        
    } catch (error) {
        console.log(`error from profileUpdate ${error}`);
        throw error
    }
}