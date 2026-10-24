module.exports = function requireCandidateRole(req, res, next) {
  const role = req.user?.role;

  if (role !== "candidate" && role !== "user") {
    return res.status(403).json({
      success: false,
      message: "Candidate access is required for this action.",
      code: "CANDIDATE_ACCESS_REQUIRED",
    });
  }

  return next();
};
