const express = require("express");
const profileRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const {
  validateEditProfileData,
  validateCurrentAndNewPassword,
} = require("../utils/validations");
const User = require("../models/user");
const bcrypt = require("bcrypt");


// View Profile Route
profileRouter.get("/view", userAuth, async (req, res) => {
  try {
    const user = req.user;
    res.send(user);
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

// Update Profile Route
profileRouter.patch("/edit", userAuth, async (req, res) => {
  try {
    const isEditAllowed = validateEditProfileData(req);
    if (!isEditAllowed) {
      throw new Error("Invalid Edit Request");
    }

    const loggedInUser = req.user;
    console.log(loggedInUser);
    Object.keys(req.body).forEach((key) => (loggedInUser[key] = req.body[key]));
    console.log(loggedInUser);

    await loggedInUser.save();
    res.json({
      message: `${loggedInUser.firstName}'s profile updated successfully!`,
      data: loggedInUser,
    });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

// changePassword Route
profileRouter.patch("/changePassword", userAuth, async (req, res) => {
  try {
    validateCurrentAndNewPassword(req);
    const user = req.user;
    const isCurrentPasswordMatch = await user.validatePassword(
      req.body.currentPassword,
    );
    if (!isCurrentPasswordMatch) {
      throw new Error("Current Password is incorrect");
    }
    const newPasswordHash = await bcrypt.hash(req.body.newPassword, 10);
    user.password = newPasswordHash;
    await user.save();
    res.json({ message: "Password changed successfully" });
  } catch (err) {
    res.status(400).send("ERROR: " + err.message);
  }
});

module.exports = profileRouter;
