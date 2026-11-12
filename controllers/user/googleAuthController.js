import passport, { googleAuthEnabled } from "../../config/passport.js";
import logger from "../../util/logger.js";

export const googleAuth = (req, res, next) => {
  if (!googleAuthEnabled) {
    return res.status(503).send("Google sign-in is not configured for this deployment.");
  }

  return passport.authenticate("google", {
    scope: ["profile", "email", "openid"],
    prompt: "consent select_account",
  })(req, res, next);
};

export const googleAuthCallback = [
  (req, res, next) => {
    if (!googleAuthEnabled) {
      return res.status(503).send("Google sign-in is not configured for this deployment.");
    }

    return passport.authenticate("google", {
      failureRedirect: "/login",
      failureMessage: true,
    })(req, res, next);
  },
  async (req, res, next) => {
    try {
      if (req.session.messages?.includes("User is blocked")) {
        await new Promise((resolve, reject) => {
          req.logout((err) => {
            if (err) return reject(err);
            req.session.destroy((destroyError) => {
              if (destroyError) return reject(destroyError);
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

        res.set("Cache-Control", "no-cache, private, no-store, must-revalidate");
        res.set("Pragma", "no-cache");
        res.set("Expires", "0");
        return res.redirect("/");
      });
    } catch (error) {
      logger.error(`Error from googleAuthCallback: ${error.message}`);
      return res.redirect("/signUpPage");
    }
  },
];
