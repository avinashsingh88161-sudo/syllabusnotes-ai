/**
 * controllers/subscriptionController.js — Razorpay payment flow
 */

const User = require("../models/User");
const { createOrder, verifySignature, isConfigured } = require("../services/razorpayService");

const PREMIUM_PRICE = parseInt(process.env.PREMIUM_PRICE_PAISE) || 49900; // ₹499

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/subscription/status
// ─────────────────────────────────────────────────────────────────────────────
exports.getStatus = async (req, res) => {
  const user = req.user;
  res.json({
    success: true,
    subscription_status: user.subscription_status,
    upload_count: user.upload_count,
    free_limit: parseInt(process.env.FREE_UPLOAD_LIMIT) || 3,
    premium_price_inr: PREMIUM_PRICE / 100,
    razorpay_configured: isConfigured(),
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/create-order — Create Razorpay order
// ─────────────────────────────────────────────────────────────────────────────
exports.createPaymentOrder = async (req, res, next) => {
  try {
    if (!isConfigured()) {
      return res.status(503).json({
        success: false,
        message: "Payment gateway not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in .env",
      });
    }

    if (req.user.subscription_status === "premium") {
      return res.status(400).json({ success: false, message: "You are already a Premium member!" });
    }

    const order = await createOrder(PREMIUM_PRICE, req.user._id.toString());

    // Save order ID for verification later
    await User.findByIdAndUpdate(req.user._id, { razorpay_order_id: order.id });

    res.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID,
      user: {
        name: req.user.name,
        email: req.user.email,
      },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/verify — Verify payment and upgrade user
// ─────────────────────────────────────────────────────────────────────────────
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment verification fields." });
    }

    // Ensure order matches stored order
    if (req.user.razorpay_order_id !== razorpay_order_id) {
      return res.status(400).json({ success: false, message: "Order ID mismatch." });
    }

    const isValid = verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return res.status(400).json({ success: false, message: "Payment verification failed. Signature mismatch." });
    }

    // Upgrade user
    await User.findByIdAndUpdate(req.user._id, {
      subscription_status: "premium",
      razorpay_payment_id,
      // Set expiry 30 days from now (optional — remove for lifetime)
      premium_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    res.json({
      success: true,
      message: "🎉 Payment verified! You are now a Premium member.",
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/subscription/mock-upgrade — DEV ONLY: instant premium upgrade
// ─────────────────────────────────────────────────────────────────────────────
exports.mockUpgrade = async (req, res, next) => {
  try {
    if (process.env.NODE_ENV === "production") {
      return res.status(403).json({ success: false, message: "Not available in production." });
    }
    await User.findByIdAndUpdate(req.user._id, { subscription_status: "premium" });
    res.json({ success: true, message: "✅ Dev mode: upgraded to Premium." });
  } catch (err) {
    next(err);
  }
};
