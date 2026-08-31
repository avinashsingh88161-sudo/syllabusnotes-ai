/**
 * services/razorpayService.js — Razorpay payment integration helpers
 */

const crypto = require("crypto");

let Razorpay;
let razorpay;

// Initialise only if keys are configured
try {
  Razorpay = require("razorpay");
  if (
    process.env.RAZORPAY_KEY_ID &&
    process.env.RAZORPAY_KEY_ID !== "rzp_test_your_key_id"
  ) {
    razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
} catch (_err) {
  console.warn("⚠️  Razorpay not initialised — payment features disabled");
}

/**
 * Create a Razorpay order
 * @param {number} amount - in paise (e.g., 49900 = ₹499)
 * @param {string} receipt - unique receipt ID (e.g., userId)
 */
async function createOrder(amount, receipt) {
  if (!razorpay) {
    throw new Error("Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env");
  }
  const order = await razorpay.orders.create({
    amount,
    currency: "INR",
    receipt: receipt.toString().slice(0, 40),
    notes: { service: "Syllabus Notes AI Premium" },
  });
  return order;
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId
 * @param {string} paymentId
 * @param {string} signature
 * @returns {boolean}
 */
function verifySignature(orderId, paymentId, signature) {
  if (!process.env.RAZORPAY_KEY_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return expected === signature;
}

module.exports = { createOrder, verifySignature, isConfigured: () => !!razorpay };
