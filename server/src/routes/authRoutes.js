const express = require("express");
const router = express.Router();
const { signup, login, getMe } = require("../controllers/authController");
const {
  validateSignup,
  validateLogin,
} = require("../validators/authValidator");
const protect = require("../middlewares/auth");

router.post("/signup", validateSignup, signup);
router.post("/login", validateLogin, login);
router.get("/me", protect, getMe);

module.exports = router;
