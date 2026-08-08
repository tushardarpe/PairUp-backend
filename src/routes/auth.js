const express = require("express");
const authRouter = express.Router();
const User = require("../models/user");
const bcrypt = require("bcrypt");
const { validateSignupData } = require("../utils/validations");

// Signup Route
authRouter.post("/signup", async (req, res) => {
  // Validation of the data
  try {
    validateSignupData(req);

    // Encrypt the password
    const {
      firstName,
      lastName,
      emailId,
      password,
      gender,
      skills,
      photoUrl,
      about,
      age,
    } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    console.log(passwordHash);

    // Creating a instance of the User model
    const user = new User({
      firstName,
      lastName,
      emailId,
      password: passwordHash,
      gender,
      skills,
      photoUrl,
      about,
      age,
    });

    await user.save();
    res.send("User saved successfully into the database");
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

// Login Route
authRouter.post("/login", async (req, res) => {
  try {
    const { emailId, password } = req.body;

    const user = await User.findOne({ emailId: emailId });
    if (!user) {
      throw new Error("Invalid Credentials");
    }
    const isPasswordMatch = await user.validatePassword(password);
    if (isPasswordMatch) {
      // Create a JWT Token
      const token = await user.getJWT();

      // Add the token to the cookie and send the response back to the user
      res.cookie("token", token, {
        expires: new Date(Date.now() + 1 * 3600000),
      });
      // Remove password before sending ✅
      const userObj = user.toObject();
      delete userObj.password;

      res.send(userObj);
    } else {
      throw new Error("Invalid Credentials");
    }
  } catch (err) {
    res.status(400).json({
      message: err.message,
    });
  }
});

// Logout Route
authRouter.post("/logout", async (req, res) => {
  res.cookie("token", null, {
    expires: new Date(Date.now()),
  });
  res.status(200).json({
    message: "Logout Successful!",
  });
});

module.exports = authRouter;
