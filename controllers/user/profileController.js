import { profileUpdate } from "../../service/user/profileService.js";

export const ProfileUser = (req, res) => {
    try {
        const user = req.session.userDetail
        return res.render('profile', {user})
    } catch (error) {
        console.log(`error from profileUser ${error}`);
        return res.redirect('/')
    }
}

export const editProfile = (req, res) => {
    try {
        const user = req.session.userDetail
        return res.render('editProfile', {user})
    } catch (error) {
        console.log(`error from editProfile ${error}`);
        return res.redirect('/profile')
    }
}

export const updateProfile = async (req, res) => {
  try {
    const user = req.session.userDetail;
    const result = await profileUpdate(req.body, req.file, user, req);

    if (result === 'User not found') {
      return res.json({ success: false, message: 'User not found' });
    }

    req.session.userDetail = result;
    return res.json({ success: true, message: 'Profile updated successfully' });
  } catch (error) {
    console.log(`error from updateProfile ${error}`);
    return res.json({ success: false, message: 'An unexpected error occurred' });
  }
};