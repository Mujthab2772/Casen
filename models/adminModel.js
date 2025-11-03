import mongoose from "mongoose";

const adminSchema = new mongoose.Schema({
    adminId: {
        type: String,
        required: true,
        unique: true
    },
    adminName: {
        type: String,
        required: true,
        trim: true
    },
    adminPassword: {
        type: String,
        required: true
    }
}, {
    timestamps: true
})

const Admin = mongoose.model("Admin", adminSchema)

export default Admin