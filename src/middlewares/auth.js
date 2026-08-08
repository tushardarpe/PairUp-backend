const jwt = require("jsonwebtoken");
const User = require("../models/user");

const userAuth = async (req, res, next) => {
  try {
    // Read the token from the req cookies
    const cookies = req.cookies;
    const { token } = cookies;

    if (!token) {
      return res.status(401).json({
        success: false,
        message: "Please login",
      });
    }

    // Validate token
    const decodedObj = await jwt.verify(token, "DEV@Tinder$3912");

    const { _id } = decodedObj;

    // Find user from database using the id in the token
    const user = await User.findById(_id).select("-password");
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    req.user = user;
    next();
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
};

module.exports = { userAuth };
