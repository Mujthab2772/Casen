import passport from "passport";

export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email", "openid"],
  prompt: "consent select_account",
});

export const googleAuthCallback = [
  passport.authenticate("google", {
    failureRedirect: "/user/loginPage",
    failureMessage: true,
  }),
  async (req, res) => {
    try {
      // check for blocked user message
      if (req.session.messages && req.session.messages.includes("User is blocked")) {
        // logout correctly for Passport v0.6+
        await new Promise((resolve, reject) => {
          req.logout((err) => {
            if (err) return reject(err);
            req.session.destroy(() => {
              resolve();
            });
          });
        });

        return res.redirect("/user/loginPage?error=UserBlocked");
      }

      // if not blocked
      res.redirect("/user/HomePage");
    } catch (error) {
      console.log(`error from googleAuthCallback ${error}`);
      res.redirect("/user/signUpPage");
    }
  },
];
