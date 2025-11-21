

// Middleware: Redirect if already authenticated
export const preventAuthAccess = (req, res, next) => {
  if (req.session.isAuthenticated) {
    return res.redirect('/');
  }
  return next();
};


export const requireUserNotAdmin = (req, res, next) => {
  // If admin is logged in, redirect to /admin
  // if (req.session.adminUsr) {
  //   return res.redirect('/admin');
  // }
  // If normal user is logged in, allow
  if (req.session.isAuthenticated) {
    return next();
  }
  // If no session, allow (public page)
  return next();
};