import nodemailer from "nodemailer";

export const sendOtpEmail = async (email, otp) => {
    const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
        }
    })

    const mailOptions = {
        from: "no-reply@casen.com",
        to: email,
        subject: "Your OTP Code",
        text: `Your OTP is ${otp}. It expires in 2 minutes`
    }

    await transporter.sendMail(mailOptions)
}