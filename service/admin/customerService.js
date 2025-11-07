import userCollection from "../../models/userModel.js";

export const customerDetails = async (searchedUser = null, page, limit = 5) => {
    try {
        const skip = (page - 1) * limit
        let countCustomers = await userCollection.countDocuments({})

        let userDetails

        if(!searchedUser){
            userDetails = await userCollection
                .find({}, { _id: 1, userId: 1, firstName: 1, lastName: 1, email: 1, phoneNumber: 1, profilePic: 1, isActive: 1, createdAt: 1, updatedAt: 1 })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);
        }else{
            const userIds = searchedUser.map(user => user.userId);

            // Query all at once and paginate
            userDetails = await userCollection
            .find(
            { userId: { $in: userIds } },
            {
            _id: 1, userId: 1, firstName: 1, lastName: 1,
            email: 1, phoneNumber: 1, profilePic: 1,
            isActive: 1, createdAt: 1, updatedAt: 1
            }
            )
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

            countCustomers = await userCollection.find({userId: {$in: userIds}}).countDocuments({})
        }

        return {userDetails, countCustomers, skip, end: Math.min(skip + limit, countCustomers)}

    } catch (error) {
        console.log(`Error from customerDetails ${error}`);
        throw error
    }
}

export const toggleBlockAndUnblock = async (userId) => {
    try {
        let userDetail = await userCollection.findById({_id: userId})

        if(!userDetail) throw new Error("User Not Found")

        if(userDetail.isActive) {            
            await userCollection.updateOne({_id: userId}, {$set: {isActive: false}})
        }else {
            await userCollection.updateOne({_id: userId}, {$set: {isActive: true}})
        }
    } catch (error) {
        console.log(`Error from toggleBlockAndUnblock ${error}`);
        throw error
    }
}

export const searchForUser = async (searchBar) => {
    try {
        let searchUsers = await userCollection.find({
            $or: [
                { firstName: { $regex: searchBar, $options: "i" } },
                { lastName: { $regex: searchBar, $options: "i" } },
                { email: { $regex: `${searchBar}.*@`, $options: "i" } },
                { phoneNumber: { $regex: searchBar, $options: "i" } }
            ]
        }).sort({createdAt: -1})

        return searchUsers
    } catch (error) {
        console.log(`Error from searchForUser ${error}`);
        throw error
    }
}