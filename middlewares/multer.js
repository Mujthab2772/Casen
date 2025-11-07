import multer from "multer";
import path from "path"

const storage = multer.diskStorage({
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname))
    }
})

const fileFilter = (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/
    const isValid = allowed.test(path.extname(file.originalname).toLowerCase())

    if(isValid) cb(null, true)
        else cb(new Error("Only images are allowed"))
}

const upload = multer({storage, fileFilter})
export default upload