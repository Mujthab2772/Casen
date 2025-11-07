import cloudinary from "../config/cloudinary.js"
import fs from "fs"

export const uploadToCloudinary = async (localFilePath, folderName = "uploads") => {
    try {
        if (!localFilePath) return null

        const result = await cloudinary.uploader.upload(localFilePath, {
            folder: folderName
        })

        fs.unlink(localFilePath, (err) => {
            if (err) console.error("File deletion failed:", err);
        });

        
        
        return result.secure_url
    } catch (error) {
        console.log(`cloudinary upload error : ${error}`);
        fs.unlinkSync(localFilePath)
        return null
    }
}