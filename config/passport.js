import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userCollection from "../models/userModel.js";

export const googleAuthEnabled = Boolean(
  process.env.GOOGLE_CLIENT_ID &&
  process.env.GOOGLE_CLIENT_SECRET &&
  process.env.GOOGLE_CALLBACK_URL
);

if (googleAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL,
      },
      async (accessToken, refreshToken, profile, done) => {
        try {
          if (!profile?.emails?.length) {
            return done(null, false, { message: "No email found in Google profile." });
          }

          const email = profile.emails[0].value;
          let user = await userCollection.findOne({ email });

          if (user) {
            if (!user.isActive) {
              return done(null, false, { message: "User is blocked" });
            }

            if (!user.profilePic) {
              user.profilePic = profile.photos?.[0]?.value || null;
              await user.save();
            }
            return done(null, user);
          }

          user = new userCollection({
            userId: profile.id,
            firstName: profile.name?.givenName || "Unknown",
            lastName: profile.name?.familyName || "",
            email,
            profilePic: profile.photos?.[0]?.value || null,
            isVerified: true,
            authProvider: "google",
            isActive: true,
          });

          await user.save();
          return done(null, user);
        } catch (error) {
          console.error("Google OAuth error:", error);
          return done(null, false, { message: "Authentication failed. Try again later." });
        }
      }
    )
  );
} else {
  console.warn("Google OAuth is disabled: set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_CALLBACK_URL to enable it.");
}

passport.serializeUser((user, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userCollection.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
