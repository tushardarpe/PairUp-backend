const express = require("express");
const paymentRouter = express.Router();
const { userAuth } = require("../middlewares/auth");
const razorPayInstance = require("../utils/razorpay");
const Payment = require("../models/payment");
const User = require("../models/user");
const { MEMBERSHIP_PLANS } = require("../utils/constant");
const {
  validateWebhookSignature,
} = require("razorpay/dist/utils/razorpay-utils");

paymentRouter.post("/create", userAuth, async (req, res) => {
  try {
    const { membershipType, duration } = req.body;
    const { firstName, lastName, emailId } = req.user;

    const plan = MEMBERSHIP_PLANS[membershipType];

    if (!plan || !plan[duration]) {
      return res.status(400).json({
        msg: "Invalid membership plan or duration",
      });
    }

    const amount = plan[duration];

    const order = await razorPayInstance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: `pairup_${req.user._id}_${Date.now()}`,
      notes: {
        firstName,
        lastName,
        emailId,
        membershipType,
        duration,
      },
    });

    // Save it in my Database
    console.log("Order created:", order);
    const payment = new Payment({
      orderId: order.id,
      status: order.status,
      userId: req.user._id,
      amount: order.amount,
      currency: order.currency,
      receipt: order.receipt,
      notes: order.notes,
    });

    const savedPayment = await payment.save();

    // Return the order details to the frontend
    res.json({ ...savedPayment.toJSON(), keyId: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

paymentRouter.post("/webhook", async (req, res) => {
  try {
    const webhookSignature = req.get("X-Razorpay-Signature");
    const isWebhookValid = validateWebhookSignature(
      JSON.stringify(req.body),
      webhookSignature,
      process.env.RAZORPAY_WEBHOOK_SECRET,
    );

    console.log("Webhook signature valid:", isWebhookValid);

    if (!isWebhookValid) {
      return res.status(400).json({ msg: "Webhook Signature is Invalid!" });
    }

    // Update my payment status in DB
    const paymentDetails = req.body.payload.payment.entity;

    const payment = await Payment.findOne({ orderId: paymentDetails.order_id });

    payment.status = paymentDetails.status;
    await payment.save();

    const user = await User.findOne({ _id: payment.userId });
    user.isPremium = true;
    user.membershipType = payment.notes.membershipType;
    user.membershipDuration = payment.notes.duration;
    await user.save();

    // Update the user as Premium

    // return success response to razorpay

    // if (req.body.event === "payment.captured") {
    // }

    // if (req.body.event === "payment.failed") {
    // }

    return res.status(200).json({ msg: "Webhook received successfully" });
  } catch (err) {
    console.error("========== WEBHOOK ERROR ==========");
    console.error(err);
    return res.status(500).json({ msg: err.message });
  }
});

paymentRouter.get("/premium/verify", userAuth, async (req, res) => {
  try {
    const user = req.user;
    let membershipType = user.membershipType;
    let duration = user.membershipDuration;

    // Fall back to the latest payment for users who became premium before
    // membershipDuration was added to the User model.
    if (user.isPremium && (!membershipType || !duration)) {
      const latestPayment = await Payment.findOne({ userId: user._id }).sort({
        _id: -1,
      });

      if (!membershipType && latestPayment) {
        membershipType = latestPayment.notes.membershipType;
      }

      if (!duration && latestPayment) {
        duration = latestPayment.notes.duration;
      }
    }

    return res.json({
      isPremium: Boolean(user.isPremium),
      membership: user.isPremium && membershipType
        ? {
            type: membershipType,
            duration: duration || null,
          }
        : null,
      // Keep these fields available for simple/legacy frontend consumers.
      membershipType: user.isPremium ? membershipType || null : null,
      duration: user.isPremium ? duration || null : null,
    });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = paymentRouter;
