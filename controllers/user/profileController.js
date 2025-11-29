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

export const updateProfile = (req, res) => {
    try {
        console.log(req.body)
        console.log(req.file)
    } catch (error) {
        console.log(`error from updateProfile ${error}`);
        return res.redirect('/profile')
    }
}