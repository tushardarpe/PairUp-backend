const cron = require("node-cron");
const { subDays, startOfDay, endOfDay } = require("date-fns");
const sendEmail = require("./sendEmail");
const ConnectionRequest = require("../models/connectionRequest");

cron.schedule("19 19 * * *", async () => {
  // Send emails to all people who got requests today

  try {
    const today = subDays(new Date(), 0);

    const todayStart = startOfDay(today);
    const todayEnd = endOfDay(today);

    const pendingRequestsOfToday = await ConnectionRequest.find({
      status: "interested",
      createdAt: {
        $gte: todayStart,
        $lte: todayEnd,
      },
    }).populate("fromUserId toUserId");

    const listOfEmails = [
      ...new Set(
        pendingRequestsOfToday.map((request) => request.toUserId.emailId),
      ),
    ];

    console.log("List of emails to send:", listOfEmails);

    for (const email of listOfEmails) {
      // Send Emails

      try {
        const res = await sendEmail.run(
          "New Friend Requests pending for " + email,
          "You have new friend requests pending for you. Please check your account.",
        );

        console.log('emailRes',res);
      } catch (err) {
        console.log('error',err);
      }
    }
  } catch (err) {
    console.log("Error", err);
  }
});
