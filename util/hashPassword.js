import bcrypt from "bcrypt"

export const hashPassword = async (plainPassword) => {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(plainPassword, saltRounds);
    return hashedPassword;
}

export const comparePassword = async (plainPassword,  hashPassword) => {
    return await bcrypt.compare(plainPassword, hashPassword)
}