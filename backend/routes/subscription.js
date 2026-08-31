/**
 * routes/subscription.js
 */
const express = require("express");
const router = express.Router();
const { protect } = require("../middleware/auth");
const {
  getStatus,
  createPaymentOrder,
  verifyPayment,
  mockUpgrade,
} = require("../controllers/subscriptionController");

router.get("/status",         protect, getStatus);
router.post("/create-order",  protect, createPaymentOrder);
router.post("/verify",        protect, verifyPayment);
router.post("/mock-upgrade",  protect, mockUpgrade); // DEV ONLY

module.exports = router;
