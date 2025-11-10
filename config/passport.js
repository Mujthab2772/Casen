import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import userCollection from "../models/userModel.js"; // adjust your path

passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        if (!profile || !profile.emails || profile.emails.length === 0) {
          console.error("Google profile missing email.");
          return done(null, false, { message: "No email found in Google profile." });
        }

        const email = profile.emails[0].value;
        let user = await userCollection.findOne({ email });

        if(user) {
          user.profilePic = profile.photos?.[0]?.value || "default.jpg";
          await user.save();
          return done(null, user);
        }

        if (!user) {
          user = new userCollection({
            userId: profile.id,
            firstName: profile.name?.givenName || "Unknown",
            lastName: profile.name?.familyName || "",
            email,
            profilePic: profile.photos?.[0]?.value || "default.jpg",
            isVerified: true,
            authProvider: "google",
          });

          try {
            await user.save();
          } catch (saveError) {
            console.error("Error saving new Google user:", saveError);
            return done(null, false, { message: "Database error while saving user." });
          }
        }

        return done(null, user);
      } catch (error) {
        console.error("Google OAuth error:", error);
        // Don't crash the app — just fail gracefully
        return done(null, false, { message: "Authentication failed. Try again later." });
      }
    }
  )
);

// Optional: serialize/deserialize safely
passport.serializeUser((user, done) => {
  try {
    done(null, user._id);
  } catch (error) {
    console.error("Serialize user error:", error);
    done(error);
  }
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await userCollection.findById(id);
    done(null, user);
  } catch (error) {
    console.error("Deserialize user error:", error);
    done(error, null);
  }
});

export default passport