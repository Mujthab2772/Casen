import admincollection from "../../models/adminModel.js";
import { v4 as uuidv4 } from "uuid";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const checkAdmin = async () => {
    try {
        let defaultAdmin = await admincollection.findOne({
            adminName: process.env.ADMIN_NAME
        });

        if (!defaultAdmin) {
            const adminData = {
                adminId: uuidv4(),
                adminName: process.env.ADMIN_NAME,
                adminPassword: process.env.ADMIN_PASSWORD
            };

            const newAdmin = new admincollection(adminData);
            await newAdmin.save();
            return newAdmin;
        }

        return defaultAdmin;
    } catch (error) {
        logger.error(`Error in checkAdmin service: ${error.message}`);
        throw error; 
    }
};

export const validateAdminLogin = async (adminName, adminPassword) => {
    try {
        let admin = await admincollection.findOne({ adminName });

        if (!admin) {
            return { status: "Not Found" };
        }

        if (admin.adminPassword === adminPassword) {
            return { status: "Success", admin };
        } else {
            return { status: "Password Incorrect" };
        }
    } catch (error) {
        logger.error(`Error from validateAdminLogin service: ${error.message}`);
        throw error;
    }
};