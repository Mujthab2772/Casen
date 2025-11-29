import addressCollection from "../../models/addressModel.js"
import { v4 as uuidv4 } from "uuid";

export const addressAdd = async (details, userId) => {
    try {
        const { fullName, streetAddress, mobile, city, state, postalcode, country, defaultOption } = details

        if(defaultOption) {
            await addressCollection.updateMany({userId: userId, isDefault: true}, {$set: {isDefault: false}})
        }

        const addressDetails = new addressCollection({
            addressId: uuidv4(),
            userId: userId,
            fullName: fullName,
            streetAddress: streetAddress,
            phoneNumber: mobile,
            city: city,
            state: state,
            postalCode: postalcode,
            country: country,
            isDefault: (defaultOption) ? true : false
        })

        await addressDetails.save()

        return addressDetails
    } catch (error) {
        console.log(`error from addressAdd ${error}`);
        throw error
    }
}

export const addressDetails = async (userId) => {
    try {
        const details = await addressCollection.find({userId: userId}).sort({isDefault: -1, createdAt: -1})
        return details
    } catch (error) {
        console.log(`error from addressDetails ${error}`);
        throw error
    }
}

export const editAddressDetails = async (addressId) => {
    try {
        const data = await addressCollection.find({addressId})
        return data
    } catch (error) {
        console.log(`error from editAddressDetails ${error}`)
        throw error
    }
}

export const editAddressDetailsUpdate = async (updateDetails, addressId, userId) => {
    try {
        const { fullName, streetAddress, mobile, city, state, postalcode, country, defaultOption } = updateDetails

        if(defaultOption) {
            await addressCollection.updateMany({userId: userId, isDefault: true}, {$set: {isDefault: false}})
        }

        const address = await addressCollection.findOne({addressId})

        if(!address) return 'Address Not found'

        address.fullName = fullName || address.fullName
        address.streetAddress = streetAddress || address.streetAddress
        address.phoneNumber = mobile || address.phoneNumber
        address.city = city || address.city
        address.state = state || address.state
        address.country = country || address.country
        address.postalCode = postalcode || address.postalCode
        address.isDefault = (defaultOption) ? true : false

        await address.save()
        return address
    } catch (error) {
        console.log(`error from editAddressDetailsUpdate ${error}`);
        throw error
    }
}

export const addressDelete = async (addressId) => {
    try {
        const result = await addressCollection.deleteOne({addressId})

        return 'success'
    } catch (error) {
        console.log(`error from addressDelete ${error}`)
        throw error
    }
}