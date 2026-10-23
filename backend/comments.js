
const express = require("express");
const pool = require("./db");
const { authenticateToken } = require("./middleware");

const router = express.Router();

// Get comments for a task
router.get("/task/:taskId", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, u.name AS user_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       JOIN tasks t ON t.id = c.task_id
       JOIN projects p ON p.id = t.project_id
       WHERE c.task_id = $1
         AND (
           p.project_manager_id = $2
           OR EXISTS (
             SELECT 1 FROM project_members pm
             WHERE pm.project_id = p.id AND pm.user_id = $2
           )
           OR $3 = 'admin'
         )
       ORDER BY c.created_at ASC`,
      [req.params.taskId, req.user.id, req.user.role]
    );

    res.json({ comments: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch comments" });
  }
});

// Add a comment to a task
router.post("/task/:taskId", authenticateToken, async (req, res) => {
  try {
    const { body } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    const access = await pool.query(
      `SELECT t.id
       FROM tasks t
       JOIN projects p ON p.id = t.project_id
       WHERE t.id = $1
         AND (
           p.project_manager_id = $2
           OR EXISTS (
             SELECT 1 FROM project_members pm
             WHERE pm.project_id = p.id AND pm.user_id = $2
           )
           OR $3 = 'admin'
         )`,
      [req.params.taskId, req.user.id, req.user.role]
    );

    if (!access.rows.length) {
      return res.status(403).json({
        message: "You cannot comment on this task",
      });
    }

    const result = await pool.query(
      `INSERT INTO comments (task_id, user_id, body)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [req.params.taskId, req.user.id, body.trim()]
    );

    res.status(201).json({ comment: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add comment" });
  }
});

module.exports = router;
