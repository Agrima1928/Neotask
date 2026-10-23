
const express = require("express");
const pool = require("./db");
const {
  authenticateToken,
  authorizeRoles,
} = require("./middleware");

const router = express.Router();

// GET /api/projects
// Return projects visible to the logged-in user.
router.get("/", authenticateToken, async (req, res) => {
  try {
    let result;

    if (req.user.role === "admin") {
      // Admin can see every project.
      result = await pool.query(
        `SELECT * FROM projects ORDER BY created_at DESC`
      );
    } else if (req.user.role === "project_manager") {
      // Managers see projects assigned to them.
      result = await pool.query(
        `SELECT * FROM projects
         WHERE project_manager_id = $1
         ORDER BY created_at DESC`,
        [req.user.id]
      );
    } else {
      // Team members and viewers see projects they belong to.
      result = await pool.query(
        `SELECT p.*
         FROM projects p
         JOIN project_members pm ON pm.project_id = p.id
         WHERE pm.user_id = $1
         ORDER BY p.created_at DESC`,
        [req.user.id]
      );
    }

    res.json({ projects: result.rows });
  } catch (error) {
    console.error("Fetch projects error:", error.message);
    res.status(500).json({ message: "Could not fetch projects" });
  }
});

// POST /api/projects
// Only Admin can create projects.
router.post(
  "/",
  authenticateToken,
  authorizeRoles("admin"),
  async (req, res) => {
    try {
      const { name, description = "", project_manager_id } = req.body;

      if (
        typeof name !== "string" ||
        !name.trim() ||
        (description !== undefined &&
          typeof description !== "string")
      ) {
        return res.status(400).json({
          message: "A valid project name and description are required",
        });
      }

      const managerId = Number(project_manager_id);

      if (!Number.isInteger(managerId) || managerId <= 0) {
        return res.status(400).json({
          message: "A valid project manager ID is required",
        });
      }

      // Ensure the selected user is actually a Project Manager.
      const manager = await pool.query(
        `SELECT id FROM users
         WHERE id = $1 AND role = 'project_manager'`,
        [managerId]
      );

      if (manager.rowCount === 0) {
        return res.status(400).json({
          message: "Selected user is not a Project Manager",
        });
      }

      const result = await pool.query(
        `INSERT INTO projects
           (name, description, created_by, project_manager_id)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [
          name.trim(),
          description,
          req.user.id,
          managerId,
        ]
      );

      res.status(201).json({
        message: "Project created successfully",
        project: result.rows[0],
      });
    } catch (error) {
      console.error("Create project error:", error.message);
      res.status(500).json({ message: "Could not create project" });
    }
  }
);

module.exports = router;
