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
    console.log("========== RAZORPAY WEBHOOK RECEIVED ==========");
    console.log("Event:", req.body.event);
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

    console.log("Razorpay payment ID:", paymentDetails.id);
    console.log("Razorpay order ID:", paymentDetails.order_id);
    console.log("Payment status:", paymentDetails.status);

    const payment = await Payment.findOne({ orderId: paymentDetails.order_id });

    console.log("Payment found in DB:", !!payment);
    payment.status = paymentDetails.status;
    await payment.save();

    console.log("Payment status updated in DB");

    const user = await User.findOne({ _id: payment.userId });
    console.log("User found:", !!user);
    console.log("User ID:", payment.userId);
    user.isPremium = true;
    user.membershipType = payment.notes.membershipType;
    await user.save();

    console.log("========== PREMIUM ACTIVATED ==========");
    console.log("User:", user.emailId);
    console.log("isPremium:", user.isPremium);
    console.log("membershipType:", user.membershipType);

    // Update the user as Premium

    // return success response to razorpay

    // if (req.body.event === "payment.captured") {
    // }

    // if (req.body.event === "payment.failed") {
    // }

    return res.status(200).json({ msg: "Webhook received successfully" });
  } catch (err) {
    return res.status(500).json({ msg: err.message });
  }
});

module.exports = paymentRouter;
