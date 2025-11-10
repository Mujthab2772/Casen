import passport from "passport";

export const googleAuth = passport.authenticate("google", {scope: ["profile", "email"], prompt: 'consent select_account'})

export const googleAuthCallback = [
    passport.authenticate("google", {failureRedirect: "/user/signUpPage"}),
    (req, res) => {
        try {         
            res.redirect("/user/HomePage")
        } catch (error) {
            console.log(`error from googleAuthCallback ${error}`);
            res.redirect('/user/signUpPage')
        }
    },
]


