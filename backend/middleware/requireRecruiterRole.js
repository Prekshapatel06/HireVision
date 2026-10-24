module.exports = function requireRecruiterRole(req, res, next) {
  const role = req.user?.role;

  if (role !== "recruiter") {
    return res.status(403).json({
      message: "Recruiter access is required for this resource.",
    });
  }

  return next();
};
