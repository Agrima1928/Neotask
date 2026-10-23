
const express = require("express");
const pool = require("./db");
const { authenticateToken } = require("./middleware");

const router = express.Router();

async function canManageProject(projectId, user) {
  if (user.role === "admin") return true;

  if (user.role !== "project_manager") return false;

  const result = await pool.query(
    "SELECT id FROM projects WHERE id = $1 AND project_manager_id = $2",
    [projectId, user.id]
  );

  return result.rows.length > 0;
}

// GET project members
router.get("/:projectId", authenticateToken, async (req, res) => {
  try {
    const access = await pool.query(
      `SELECT id FROM projects
       WHERE id = $1 AND (
         project_manager_id = $2 OR $3 = 'admin' OR
         EXISTS (
           SELECT 1 FROM project_members
           WHERE project_id = projects.id AND user_id = $2
         )
       )`,
      [req.params.projectId, req.user.id, req.user.role]
    );

    if (!access.rows.length) {
      return res.status(403).json({ message: "You cannot view this team" });
    }

    const result = await pool.query(
      `SELECT u.id, u.name, u.email, u.role
       FROM project_members pm
       JOIN users u ON u.id = pm.user_id
       WHERE pm.project_id = $1
       ORDER BY u.name`,
      [req.params.projectId]
    );

    res.json({ members: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch team members" });
  }
});

// ADD a member to a project
router.post("/:projectId", authenticateToken, async (req, res) => {
  try {
    if (!(await canManageProject(req.params.projectId, req.user))) {
      return res.status(403).json({ message: "You cannot manage this team" });
    }

    const { user_id } = req.body;

    if (!Number.isInteger(user_id)) {
      return res.status(400).json({ message: "A valid user_id is required" });
    }

    const user = await pool.query(
      "SELECT id, role FROM users WHERE id = $1",
      [user_id]
    );

    if (!user.rows.length || user.rows[0].role === "admin") {
      return res.status(400).json({ message: "Invalid project member" });
    }

    const project = await pool.query(
      "SELECT id FROM projects WHERE id = $1",
      [req.params.projectId]
    );

    if (!project.rows.length) {
      return res.status(404).json({ message: "Project not found" });
    }

    await pool.query(
      `INSERT INTO project_members (project_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.projectId, user_id]
    );

    res.status(201).json({ message: "Member added to project" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to add member" });
  }
});

// REMOVE a member from a project
router.delete("/:projectId/:userId", authenticateToken, async (req, res) => {
  try {
    if (!(await canManageProject(req.params.projectId, req.user))) {
      return res.status(403).json({ message: "You cannot manage this team" });
    }

    const result = await pool.query(
      `DELETE FROM project_members
       WHERE project_id = $1 AND user_id = $2
       RETURNING user_id`,
      [req.params.projectId, req.params.userId]
    );

    if (!result.rows.length) {
      return res.status(404).json({ message: "Project member not found" });
    }

    res.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to remove member" });
  }
});

module.exports = router;
