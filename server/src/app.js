require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const rateLimit = require("express-rate-limit");

const contactRoutes = require("./routes/contactRoutes");
const authRoutes = require("./routes/authRoutes");
const locationRoutes = require("./routes/locationRoutes");
const educationRoutes = require("./routes/educationRoutes");
const coachingRoutes  = require("./routes/coachingRoutes");
const mailerLiteRoutes = require("./routes/mailerLiteRoutes");
const gLeadsRoutes     = require("./routes/gLeadsRoutes");
const { errorHandler, notFound } = require("./middlewares/errorHandler");

const app = express();

// --------------- Middleware ---------------
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "http://localhost:3000",
    credentials: true,
  })
);
app.use(morgan("dev"));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200,
  message: { success: false, message: "Too many requests, please try again later." },
});
app.use("/api", limiter);

// --------------- Routes ---------------
app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "Server is running", timestamp: new Date().toISOString() });
});

app.use("/api/auth", authRoutes);
app.use("/api/contacts", contactRoutes);
app.use("/api/locations", locationRoutes);
app.use("/api/education", educationRoutes);
app.use("/api/coaching",  coachingRoutes);
app.use("/api/mailerlite", mailerLiteRoutes);
app.use("/api/gleads",    gLeadsRoutes);

// --------------- Error Handling ---------------
app.use(notFound);
app.use(errorHandler);

module.exports = app;
