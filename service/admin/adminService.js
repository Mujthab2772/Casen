import admincollection from "../../models/adminModel.js";
import { v4 as uuidv4 } from "uuid";

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
        console.error("Error in checkAdmin service:", error);
        throw error; // rethrow so controller can handle it
    }
};


export const validateAdminLogin = async (adminName, adminPassword) => {
    try {
        let admin = await admincollection.findOne({adminName: adminName})

        if(!admin) {
            return {status: "Not Found"}
        }

        if(admin.adminPassword === adminPassword) {
            return {status: "Success", admin}
        }else{
            return {status: "Password Incorrect"}
        }
    } catch (error) {
        console.log(`Error from validateAdminLogin service ${error}`);
        throw error        
    }
}