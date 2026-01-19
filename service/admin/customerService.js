import userCollection from "../../models/userModel.js";
import logger from '../../util/logger.js'; // ✅ Add logger import

export const customerDetails = async (searchedUser = null, page, limit = 5) => {
    try {
        const skip = (page - 1) * limit;
        
        let filter = {};
        
        if (searchedUser) {
            filter = {
                $or: [
                    { firstName: { $regex: searchedUser, $options: "i" } },
                    { lastName: { $regex: searchedUser, $options: "i" } }
                ]
            };
        }
        
        const countCustomers = await userCollection.countDocuments(filter);

        const userDetails = await userCollection.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        return { userDetails, countCustomers, skip, end: Math.min(skip + limit, countCustomers) };

    } catch (error) {
        logger.error(`Error from customerDetails: ${error.message}`);
        throw error;
    }
};

export const toggleBlockAndUnblock = async (userId) => {
    try {
        const userDetail = await userCollection.findById({ _id: userId });

        if (!userDetail) throw new Error("User Not Found");

        if (userDetail.isActive) {            
            await userCollection.updateOne({ _id: userId }, { $set: { isActive: false } });
        } else {
            await userCollection.updateOne({ _id: userId }, { $set: { isActive: true } });
        }
    } catch (error) {
        logger.error(`Error from toggleBlockAndUnblock: ${error.message}`);
        throw error;
    }
};

export const searchedUser = async (searchBar) => {
    try {
        const searchUsers = await userCollection.find({
            $or: [
                { firstName: { $regex: searchBar, $options: "i" } },
                { lastName: { $regex: searchBar, $options: "i" } },
                { email: { $regex: `${searchBar}.*@`, $options: "i" } },
                { phoneNumber: { $regex: searchBar, $options: "i" } }
            ]
        }).sort({ createdAt: -1 });

        return searchUsers;
    } catch (error) {
        logger.error(`Error from searchedUser: ${error.message}`);
        throw error;
    }
};