import passport from "passport";

export const googleAuth = passport.authenticate("google", {
  scope: ["profile", "email", "openid"],
  prompt: "consent select_account",
});

export const googleAuthCallback = [
  passport.authenticate("google", {
    failureRedirect: "/login",
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

        return res.redirect("/login?error=UserBlocked");
      }

      req.session.isAuthenticated = true;
      req.session.userEmail = req.user.email;

      req.session.save((err) => {
        if (err) return next(err);

        // 🔒 Prevent back-navigation to auth screen
        res.header("Cache-Control", "no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0");
        res.header("Pragma", "no-cache");
        res.header("Expires", "0");

        res.redirect("/");
      });
    } catch (error) {
      console.log(`error from googleAuthCallback ${error}`);
      res.redirect("/signUpPage");
    }
  },
];
