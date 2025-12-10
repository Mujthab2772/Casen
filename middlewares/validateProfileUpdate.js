// middleware/validateProfileUpdate.js
import userCollection from "../models/userModel.js";

// Regex patterns
const patterns = {
  name: /^[a-zA-Z][a-zA-Z\s]*$/, // Only letters and spaces, must start with letter
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^\d{10,15}$/, // Indian format: 10 digits; allow 10–15 for international
};

export const validateProfileUpdate = async (req, res, next) => {
  const { firstName, lastName, email, phoneNumber } = req.body;
  const userId = req.session.userDetail?._id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'User not authenticated' });
  }

  // Validate names
  if (!firstName || !patterns.name.test(firstName.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid first name' });
  }
  if (!lastName || !patterns.name.test(lastName.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid last name' });
  }

  // Validate phone
  if (!phoneNumber || !patterns.phone.test(phoneNumber)) {
    return res.status(400).json({ success: false, message: 'Invalid phone number (10–15 digits)' });
  }

  // Validate email format
  if (!email || !patterns.email.test(email.trim())) {
    return res.status(400).json({ success: false, message: 'Invalid email format' });
  }

  // Normalize emails
  const newEmail = email.trim().toLowerCase();
  const currentEmail = req.session.userDetail.email.toLowerCase();

  // Only check for duplicate if email is actually changing
  if (newEmail !== currentEmail) {
    const existingUser = await userCollection.findOne({
      email: newEmail,
      _id: { $ne: userId } // Exclude current user
    });

    if (existingUser) {
      return res.status(409).json({ success: false, message: 'Email is already in use.' });
    }
  }

  // Attach normalized email to request for next middleware/controller
  req.validatedEmail = newEmail;
  req.validatedData = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    phoneNumber,
    email: newEmail
  };

  next();
};