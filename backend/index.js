
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db");
const authRoutes = require("./auth");
const {
  authenticateToken,
  authorizeRoles,
} = require("./middleware");
const projectRoutes = require("./projects");
const taskRoutes = require("./tasks");
const commentRoutes = require("./comments");
const memberRoutes = require("./members");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: "http://localhost:5174" }));
app.use(express.json());
app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);

app.get("/api/health", (req, res) => {
  res.json({ message: "NeoStats backend is running!" });
});

app.get("/api/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW()");
    res.json({
      message: "Database connected successfully!",
      time: result.rows[0].now,
    });
  } catch (error) {
    console.error("Database test failed:", error.message);
    res.status(500).json({ message: "Database connection failed" });
  }
});

app.get(
  "/api/admin-test",
  authenticateToken,
  authorizeRoles("admin"),
  (req, res) => {
    res.json({
      message: "Welcome, Admin! Access granted.",
      user: req.user,
    });
  }
);

app.use("/api/comments", commentRoutes);
app.use("/api/members", memberRoutes);

app.use((req, res) => {
  res.status(404).json({ message: "Route not found" });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
