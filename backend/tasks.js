const express = require("express");
const pool = require("./db");
const { authenticateToken } = require("./middleware");

const router = express.Router();

// Check whether the logged-in user can access a project
async function canAccessProject(projectId, user) {
  if (user.role === "admin") return true;

  const result = await pool.query(
    `SELECT p.id
     FROM projects p
     WHERE p.id = $1
       AND (
         p.project_manager_id = $2
         OR EXISTS (
           SELECT 1 FROM project_members pm
           WHERE pm.project_id = p.id AND pm.user_id = $2
         )
       )`,
    [projectId, user.id]
  );

  return result.rows.length > 0;
}

// GET all tasks visible to the logged-in user
router.get("/", authenticateToken, async (req, res) => {
  try {
    let query = `
      SELECT t.*, p.name AS project_name, u.name AS assignee_name
      FROM tasks t
      JOIN projects p ON p.id = t.project_id
      LEFT JOIN users u ON u.id = t.assigned_to
    `;
    const values = [];

    if (req.user.role === "admin") {
      // Admin can see every task.
    } else if (req.user.role === "project_manager") {
      values.push(req.user.id);
      query += ` WHERE p.project_manager_id = $1`;
    } else if (req.user.role === "team_member") {
      values.push(req.user.id);
      query += ` WHERE t.assigned_to = $1`;
    } else {
      values.push(req.user.id);
      query += ` WHERE EXISTS (
        SELECT 1 FROM project_members pm
        WHERE pm.project_id = t.project_id AND pm.user_id = $1
      )`;
    }

    query += " ORDER BY t.created_at DESC";
    const result = await pool.query(query, values);
    res.json({ tasks: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to fetch tasks" });
  }
});

// CREATE a task: Admin or the project's manager
router.post("/", authenticateToken, async (req, res) => {
  try {
    if (!["admin", "project_manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot create tasks" });
    }

    const { project_id, title, description, assigned_to } = req.body;

    if (!project_id || !title?.trim()) {
      return res.status(400).json({
        message: "project_id and title are required",
      });
    }

    const allowed = await canAccessProject(project_id, req.user);
    if (!allowed) {
      return res.status(403).json({ message: "You cannot manage this project" });
    }

    if (assigned_to) {
      const member = await pool.query(
        `SELECT 1 FROM project_members
         WHERE project_id = $1 AND user_id = $2
         UNION
         SELECT 1 FROM projects
         WHERE id = $1 AND project_manager_id = $2`,
        [project_id, assigned_to]
      );

      if (!member.rows.length) {
        return res.status(400).json({
          message: "Assignee must belong to this project",
        });
      }
    }

    const result = await pool.query(
      `INSERT INTO tasks (project_id, title, description, assigned_to)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [project_id, title.trim(), description || "", assigned_to || null]
    );

    res.status(201).json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to create task" });
  }
});

// UPDATE a task, using version to prevent overwriting newer changes
router.patch("/:id", authenticateToken, async (req, res) => {
  try {
    const { version, status, title, description, assigned_to } = req.body;

    if (!Number.isInteger(version)) {
      return res.status(400).json({
        message: "Current task version is required",
      });
    }

    const found = await pool.query(
      "SELECT * FROM tasks WHERE id = $1",
      [req.params.id]
    );

    if (!found.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    const task = found.rows[0];
    const role = req.user.role;
    const isManager = await canAccessProject(task.project_id, req.user);

    if (role === "viewer") {
      return res.status(403).json({ message: "Viewers cannot update tasks" });
    }

    if (role === "team_member") {
      if (String(task.assigned_to) !== String(req.user.id)) {
        return res.status(403).json({
          message: "You can update only tasks assigned to you",
        });
      }
      if (title !== undefined || description !== undefined || assigned_to !== undefined) {
        return res.status(403).json({
          message: "Team members can update task status only",
        });
      }
    } else if (!isManager) {
      return res.status(403).json({ message: "You cannot update this task" });
    }

    const allowedStatuses = ["todo", "in_progress", "done"];
    if (status !== undefined && !allowedStatuses.includes(status)) {
      return res.status(400).json({ message: "Invalid task status" });
    }

    const fields = [];
    const values = [];

    function addField(column, value) {
      values.push(value);
      fields.push(`${column} = $${values.length}`);
    }

    if (status !== undefined) addField("status", status);
    if (role !== "team_member") {
      if (title !== undefined) addField("title", title);
      if (description !== undefined) addField("description", description);
      if (assigned_to !== undefined) addField("assigned_to", assigned_to || null);
    }

    if (!fields.length) {
      return res.status(400).json({ message: "No changes provided" });
    }

    values.push(req.params.id, version);

    const result = await pool.query(
      `UPDATE tasks
       SET ${fields.join(", ")}, version = version + 1
       WHERE id = $${values.length - 1} AND version = $${values.length}
       RETURNING *`,
      values
    );

    if (!result.rows.length) {
      return res.status(409).json({
        message: "Task was updated by someone else. Refresh and try again.",
      });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to update task" });
  }
});

// DELETE a task: Admin or the project's manager
router.delete("/:id", authenticateToken, async (req, res) => {
  try {
    if (!["admin", "project_manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "You cannot delete tasks" });
    }

    const found = await pool.query(
      "SELECT project_id FROM tasks WHERE id = $1",
      [req.params.id]
    );

    if (!found.rows.length) {
      return res.status(404).json({ message: "Task not found" });
    }

    if (!(await canAccessProject(found.rows[0].project_id, req.user))) {
      return res.status(403).json({ message: "You cannot manage this task" });
    }

    await pool.query("DELETE FROM tasks WHERE id = $1", [req.params.id]);
    res.json({ message: "Task deleted successfully" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Failed to delete task" });
  }
});

module.exports = router;