
import { useCallback, useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function token() {
  return sessionStorage.getItem("neotaskToken");
}

function apiRequest(path, options = {}) {
  const headers = {
    Authorization: `Bearer ${token()}`,
    ...(options.body ? { "Content-Type": "application/json" } : {}),
    ...options.headers,
  };

  return fetch(`${API_URL}${path}`, { ...options, headers }).then(
    async (response) => {
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || "Something went wrong");
        error.status = response.status;
        throw error;
      }

      return data;
    }
  );
}

function formatDate(date) {
  if (!date) return "";
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime())
    ? ""
    : parsed.toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });
}

function formatStatus(status) {
  return (status || "todo")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export default function App() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("neotaskUser") || "null");
    } catch {
      return null;
    }
  });

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [projectsError, setProjectsError] = useState("");
  const [tasksError, setTasksError] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeSection, setActiveSection] = useState("dashboard");
  const [taskFilter, setTaskFilter] = useState("all");
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);

  const [projectName, setProjectName] = useState("");
  const [projectDescription, setProjectDescription] = useState("");
  const [projectManagerId, setProjectManagerId] = useState("");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskProjectId, setTaskProjectId] = useState("");
  const [taskAssigneeId, setTaskAssigneeId] = useState("");

  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [statusDrafts, setStatusDrafts] = useState({});

  // Comment state
  const [expandedComments, setExpandedComments] = useState({});
  const [commentsByTask, setCommentsByTask] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});
  const [commentsLoading, setCommentsLoading] = useState({});
  const [commentsSaving, setCommentsSaving] = useState({});
  const [commentsErrors, setCommentsErrors] = useState({});
  const [commentsNotices, setCommentsNotices] = useState({});

  const role = (user?.role || "").toLowerCase();
  const isAdmin = role === "admin";
  const isManager = role === "project_manager";
  const canManageTasks = isAdmin || isManager;

  const loadProjects = useCallback(async () => {
    if (!token()) return;

    setProjectsError("");

    try {
      const data = await apiRequest("/projects");
      setProjects(data.projects || []);
    } catch (error) {
      setProjectsError(error.message);
    }
  }, []);

  const loadTasks = useCallback(async () => {
    if (!token()) return;

    setTasksError("");

    try {
      const data = await apiRequest("/tasks");
      setTasks(data.tasks || []);
    } catch (error) {
      setTasksError(error.message);
    }
  }, []);

  const reloadData = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadProjects(), loadTasks()]);
    setLoading(false);
  }, [loadProjects, loadTasks]);

  useEffect(() => {
    if (user && token()) {
      reloadData();
    }
  }, [user, reloadData]);

  async function handleLogin(event) {
    event.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Login failed");
      }

      const authToken = data.token || data.accessToken;
      const loggedInUser = data.user;

      if (!authToken || !loggedInUser) {
        throw new Error("Login response did not include a token and user");
      }

      sessionStorage.setItem("neotaskToken", authToken);
      sessionStorage.setItem("neotaskUser", JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      setActiveSection("dashboard");
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginLoading(false);
    }
  }

  function handleLogout() {
    sessionStorage.removeItem("neotaskToken");
    sessionStorage.removeItem("neotaskUser");

    setUser(null);
    setProjects([]);
    setTasks([]);
    setCommentsByTask({});
    setExpandedComments({});
    setActiveSection("dashboard");
    setPassword("");
  }

  async function handleCreateProject(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    try {
      await apiRequest("/projects", {
        method: "POST",
        body: JSON.stringify({
          name: projectName.trim(),
          description: projectDescription.trim(),
          project_manager_id: Number(projectManagerId),
        }),
      });

      setProjectName("");
      setProjectDescription("");
      setProjectManagerId("");
      setShowProjectForm(false);
      setNotice("Project created successfully.");
      await reloadData();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTask(event) {
    event.preventDefault();
    setSaving(true);
    setNotice("");

    try {
      await apiRequest("/tasks", {
        method: "POST",
        body: JSON.stringify({
          project_id: Number(taskProjectId),
          title: taskTitle.trim(),
          description: taskDescription.trim(),
          ...(taskAssigneeId.trim()
            ? { assigned_to: Number(taskAssigneeId) }
            : {}),
        }),
      });

      setTaskTitle("");
      setTaskDescription("");
      setTaskProjectId("");
      setTaskAssigneeId("");
      setShowTaskForm(false);
      setNotice("Task created successfully.");
      await reloadData();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateTask(task) {
    const status = statusDrafts[task.id] || task.status;

    if (status === task.status) return;

    setNotice("");

    try {
      await apiRequest(`/tasks/${task.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, version: task.version }),
      });

      setNotice("Task status updated.");
      await loadTasks();
    } catch (error) {
      setNotice(
        error.status === 409
          ? "This task changed elsewhere. The latest version has been loaded."
          : error.message
      );
      await loadTasks();
    }
  }

  async function handleDeleteTask(task) {
    if (!window.confirm(`Delete task "${task.title}"?`)) return;

    setNotice("");

    try {
      await apiRequest(`/tasks/${task.id}`, { method: "DELETE" });

      setCommentsByTask((previous) => {
        const next = { ...previous };
        delete next[task.id];
        return next;
      });

      setNotice("Task deleted.");
      await reloadData();
    } catch (error) {
      setNotice(error.message);
    }
  }

  // Load comments for one task
  async function loadComments(taskId) {
    setCommentsLoading((previous) => ({ ...previous, [taskId]: true }));
    setCommentsErrors((previous) => ({ ...previous, [taskId]: "" }));

    try {
      const data = await apiRequest(`/comments/task/${taskId}`);
      setCommentsByTask((previous) => ({
        ...previous,
        [taskId]: data.comments || [],
      }));
    } catch (error) {
      setCommentsErrors((previous) => ({
        ...previous,
        [taskId]: error.message,
      }));
    } finally {
      setCommentsLoading((previous) => ({
        ...previous,
        [taskId]: false,
      }));
    }
  }

  async function toggleComments(taskId) {
    const isExpanded = Boolean(expandedComments[taskId]);

    setExpandedComments((previous) => ({
      ...previous,
      [taskId]: !isExpanded,
    }));

    if (!isExpanded && !Object.hasOwn(commentsByTask, taskId)) {
      await loadComments(taskId);
    }
  }

  // Submit a new comment
  async function handleAddComment(event, taskId) {
    event.preventDefault();

    const body = (commentDrafts[taskId] || "").trim();
    if (!body) return;

    setCommentsSaving((previous) => ({ ...previous, [taskId]: true }));
    setCommentsErrors((previous) => ({ ...previous, [taskId]: "" }));
    setCommentsNotices((previous) => ({ ...previous, [taskId]: "" }));

    try {
      await apiRequest(`/comments/task/${taskId}`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });

      setCommentDrafts((previous) => ({ ...previous, [taskId]: "" }));
      setCommentsNotices((previous) => ({
        ...previous,
        [taskId]: "Comment added successfully.",
      }));

      // Reload to include the comment author's name and timestamp.
      await loadComments(taskId);
    } catch (error) {
      setCommentsErrors((previous) => ({
        ...previous,
        [taskId]: error.message,
      }));
    } finally {
      setCommentsSaving((previous) => ({
        ...previous,
        [taskId]: false,
      }));
    }
  }

  function goTo(section) {
    setActiveSection(section);

    if (section === "projects") loadProjects();
    if (section === "tasks") loadTasks();
  }

  const visibleTasks = tasks.filter(
    (task) => taskFilter === "all" || task.status === taskFilter
  );

  if (!user) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">N</div>
          <p className="eyebrow">PROJECT MANAGEMENT PLATFORM</p>
          <h1>Welcome to Neotask</h1>
          <p className="muted">Sign in to manage your projects and tasks.</p>

          <form onSubmit={handleLogin} className="login-form">
            <label htmlFor="login-email">Email address</label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />

            <label htmlFor="login-password">Password</label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Enter your password"
              required
            />

            {loginError && <p className="error-message">{loginError}</p>}

            <button className="primary-button" disabled={loginLoading}>
              {loginLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
          <p className="login-footer">Organize work. Collaborate better.</p>
        </section>
      </main>
    );
  }

  const completedTasks = tasks.filter((task) => task.status === "done").length;
  const inProgressTasks = tasks.filter(
    (task) => task.status === "in_progress"
  ).length;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark small">N</span>
          <span>neotask</span>
        </div>

        <div className="sidebar-label">WORKSPACE</div>
        <nav className="sidebar-nav">
          <button
            className={activeSection === "dashboard" ? "active" : ""}
            onClick={() => goTo("dashboard")}
          >
            <span>▦</span> Dashboard
          </button>
          <button
            className={activeSection === "projects" ? "active" : ""}
            onClick={() => goTo("projects")}
          >
            <span>▣</span> Projects
          </button>
          <button
            className={activeSection === "tasks" ? "active" : ""}
            onClick={() => goTo("tasks")}
          >
            <span>☷</span> Tasks & Comments
          </button>
        </nav>

        <div className="sidebar-bottom">
          <div className="user-avatar">
            {(user.name || user.email || "U").charAt(0).toUpperCase()}
          </div>
          <div className="sidebar-user">
            <strong>{user.name || user.email}</strong>
            <span>{formatStatus(role)}</span>
          </div>
          <button className="logout-button" onClick={handleLogout} title="Log out">
            ↗
          </button>
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">YOUR WORKSPACE</p>
            <h1>
              {activeSection === "dashboard"
                ? "Dashboard"
                : activeSection === "projects"
                  ? "Projects"
                  : "Tasks & Comments"}
            </h1>
          </div>
          <div className="topbar-user">
            <span className="online-dot" />
            {user.name || user.email}
          </div>
        </header>

        {notice && (
          <div className="notice-message" role="status">
            {notice}
            <button onClick={() => setNotice("")} aria-label="Dismiss message">
              ×
            </button>
          </div>
        )}

        {activeSection === "dashboard" && (
          <>
            <section className="welcome-banner">
              <div>
                <p className="eyebrow light">YOUR TEAM. YOUR PROGRESS.</p>
                <h2>Let's get things done{user.name ? `, ${user.name}` : ""}.</h2>
                <p>Keep track of projects, tasks, and team conversations.</p>
              </div>
              <div className="welcome-decoration">N</div>
            </section>

            <section className="stats-grid">
              <article className="stat-card">
                <span className="stat-icon blue">▣</span>
                <p>Total projects</p>
                <h2>{projects.length}</h2>
              </article>
              <article className="stat-card">
                <span className="stat-icon purple">☷</span>
                <p>Total tasks</p>
                <h2>{tasks.length}</h2>
              </article>
              <article className="stat-card">
                <span className="stat-icon orange">◷</span>
                <p>In progress</p>
                <h2>{inProgressTasks}</h2>
              </article>
              <article className="stat-card">
                <span className="stat-icon green">✓</span>
                <p>Completed</p>
                <h2>{completedTasks}</h2>
              </article>
            </section>

            <section className="content-panel">
              <div className="section-heading">
                <div>
                  <h2>Recent projects</h2>
                  <p>Your accessible projects at a glance.</p>
                </div>
                <button className="text-button" onClick={() => goTo("projects")}>
                  View all →
                </button>
              </div>

              {projectsError && <p className="error-message">{projectsError}</p>}

              {projects.length === 0 ? (
                <div className="empty-state">
                  <span>▣</span>
                  <h3>No projects yet</h3>
                  <p>Create a project to start organizing your work.</p>
                </div>
              ) : (
                <div className="project-grid">
                  {projects.slice(0, 4).map((project) => (
                    <article className="project-card" key={project.id}>
                      <div className="project-card-icon">▣</div>
                      <h3>{project.name}</h3>
                      <p>{project.description || "No description provided."}</p>
                      <span className="project-id">PROJECT #{project.id}</span>
                    </article>
                  ))}
                </div>
              )}
            </section>

            {isAdmin && (
              <section className="content-panel">
                <div className="section-heading">
                  <div>
                    <h2>Create a project</h2>
                    <p>Start a new workspace project.</p>
                  </div>
                  <button
                    className="secondary-button"
                    onClick={() => setShowProjectForm(!showProjectForm)}
                  >
                    {showProjectForm ? "Cancel" : "+ New project"}
                  </button>
                </div>

                {showProjectForm && (
                  <form className="project-form" onSubmit={handleCreateProject}>
                    <label>Project name</label>
                    <input
                      value={projectName}
                      onChange={(event) => setProjectName(event.target.value)}
                      required
                    />
                    <label>Description</label>
                    <textarea
                      value={projectDescription}
                      onChange={(event) =>
                        setProjectDescription(event.target.value)
                      }
                      rows="3"
                    />
                    <label>Project manager user ID</label>
                    <input
                      type="number"
                      min="1"
                      value={projectManagerId}
                      onChange={(event) =>
                        setProjectManagerId(event.target.value)
                      }
                      required
                    />
                    <div className="project-form-actions">
                      <button className="create-button" disabled={saving}>
                        {saving ? "Creating..." : "Create project"}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            )}
          </>
        )}

        {activeSection === "projects" && (
          <section className="content-panel">
            <div className="section-heading">
              <div>
                <h2>All projects</h2>
                <p>Projects you are permitted to access.</p>
              </div>
              <button className="secondary-button" onClick={loadProjects}>
                Refresh
              </button>
            </div>

            {projectsError && <p className="error-message">{projectsError}</p>}

            {projects.length === 0 ? (
              <div className="empty-state">
                <h3>No projects found</h3>
                <p>Projects available to your account will appear here.</p>
              </div>
            ) : (
              <div className="project-grid">
                {projects.map((project) => (
                  <article className="project-card" key={project.id}>
                    <div className="project-card-icon">▣</div>
                    <h3>{project.name}</h3>
                    <p>{project.description || "No description provided."}</p>
                    <span className="project-id">PROJECT #{project.id}</span>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {activeSection === "tasks" && (
          <section className="content-panel">
            <div className="section-heading">
              <div>
                <h2>Tasks & discussions</h2>
                <p>Update task progress and discuss work with your team.</p>
              </div>
              <div className="task-heading-actions">
                <button className="secondary-button" onClick={loadTasks}>
                  Refresh
                </button>
                {canManageTasks && (
                  <button
                    className="create-button"
                    onClick={() => setShowTaskForm(!showTaskForm)}
                  >
                    {showTaskForm ? "Cancel" : "+ New task"}
                  </button>
                )}
              </div>
            </div>

            {tasksError && <p className="error-message">{tasksError}</p>}

            {showTaskForm && canManageTasks && (
              <form className="project-form task-form" onSubmit={handleCreateTask}>
                <label>Task title</label>
                <input
                  value={taskTitle}
                  onChange={(event) => setTaskTitle(event.target.value)}
                  required
                />

                <label>Description</label>
                <textarea
                  rows="3"
                  value={taskDescription}
                  onChange={(event) => setTaskDescription(event.target.value)}
                />

                <label>Project</label>
                <select
                  value={taskProjectId}
                  onChange={(event) => setTaskProjectId(event.target.value)}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option value={project.id} key={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>

                <label>Assignee user ID (optional)</label>
                <input
                  type="number"
                  min="1"
                  value={taskAssigneeId}
                  onChange={(event) => setTaskAssigneeId(event.target.value)}
                  placeholder="Enter team member ID"
                />

                <div className="project-form-actions">
                  <button className="create-button" disabled={saving}>
                    {saving ? "Creating..." : "Create task"}
                  </button>
                </div>
              </form>
            )}

            <div className="task-filters">
              <label htmlFor="task-filter">Filter by status</label>
              <select
                id="task-filter"
                value={taskFilter}
                onChange={(event) => setTaskFilter(event.target.value)}
              >
                <option value="all">All tasks</option>
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </div>

            {loading ? (
              <p className="muted">Loading tasks...</p>
            ) : visibleTasks.length === 0 ? (
              <div className="empty-state">
                <span>☷</span>
                <h3>No tasks found</h3>
                <p>Create a task or change the selected status filter.</p>
              </div>
            ) : (
              <div className="task-list">
                {visibleTasks.map((task) => {
                  const taskProject = projects.find(
                    (project) => Number(project.id) === Number(task.project_id)
                  );

                  const canUpdateThisTask =
                    canManageTasks ||
                    (role === "team_member" &&
                      Number(task.assigned_to) === Number(user.id));

                  return (
                    <article className="task-card" key={task.id}>
                      <div className="task-card-top">
                        <div className="task-card-title">
                          <h3>{task.title}</h3>
                          <span
                            className={`task-status status-${task.status}`}
                          >
                            {formatStatus(task.status)}
                          </span>
                        </div>
                        <span className="task-version">
                          Version {task.version}
                        </span>
                      </div>

                      {task.description && (
                        <p className="task-description">{task.description}</p>
                      )}

                      <div className="task-metadata">
                        <span>
                          Project: <strong>{taskProject?.name || `#${task.project_id}`}</strong>
                        </span>
                        <span>
                          Assignee: <strong>{task.assigned_to ?? "Unassigned"}</strong>
                        </span>
                      </div>

                      {canUpdateThisTask && (
                        <div className="task-actions">
                          <label htmlFor={`status-${task.id}`}>Update status</label>
                          <select
                            id={`status-${task.id}`}
                            value={statusDrafts[task.id] ?? task.status}
                            onChange={(event) =>
                              setStatusDrafts((previous) => ({
                                ...previous,
                                [task.id]: event.target.value,
                              }))
                            }
                          >
                            <option value="todo">To do</option>
                            <option value="in_progress">In progress</option>
                            <option value="done">Done</option>
                          </select>
                          <button
                            className="create-button"
                            onClick={() => handleUpdateTask(task)}
                            disabled={
                              (statusDrafts[task.id] ?? task.status) ===
                              task.status
                            }
                          >
                            Save status
                          </button>

                          {canManageTasks && (
                            <button
                              className="delete-task-button"
                              onClick={() => handleDeleteTask(task)}
                            >
                              Delete task
                            </button>
                          )}
                        </div>
                      )}

                      {/* Comments section */}
                      <div className="comments-section">
                        <button
                          className="comments-toggle"
                          onClick={() => toggleComments(task.id)}
                          aria-expanded={Boolean(expandedComments[task.id])}
                        >
                          <span>▤</span>
                          Comments
                          {commentsByTask[task.id] && (
                            <span className="comment-count">
                              {commentsByTask[task.id].length}
                            </span>
                          )}
                          <span className="comments-chevron">
                            {expandedComments[task.id] ? "−" : "+"}
                          </span>
                        </button>

                        {expandedComments[task.id] && (
                          <div className="comments-content">
                            {commentsLoading[task.id] ? (
                              <p className="muted">Loading comments...</p>
                            ) : commentsErrors[task.id] ? (
                              <div>
                                <p className="error-message">
                                  {commentsErrors[task.id]}
                                </p>
                                <button
                                  className="text-button"
                                  onClick={() => loadComments(task.id)}
                                >
                                  Try again
                                </button>
                              </div>
                            ) : (
                              <>
                                {(!commentsByTask[task.id] ||
                                  commentsByTask[task.id].length === 0) && (
                                  <p className="no-comments">
                                    No comments yet. Start the conversation.
                                  </p>
                                )}

                                <div className="comment-list">
                                  {(commentsByTask[task.id] || []).map(
                                    (comment) => (
                                      <div
                                        className="comment-item"
                                        key={comment.id}
                                      >
                                        <div className="comment-avatar">
                                          {(
                                            comment.user_name ||
                                            comment.author_name ||
                                            "U"
                                          )
                                            .charAt(0)
                                            .toUpperCase()}
                                        </div>
                                        <div className="comment-main">
                                          <div className="comment-header">
                                            <strong>
                                              {comment.user_name ||
                                                comment.author_name ||
                                                `User #${comment.user_id}`}
                                            </strong>
                                            <time>
                                              {formatDate(comment.created_at)}
                                            </time>
                                          </div>
                                          <p className="comment-body">
                                            {comment.body}
                                          </p>
                                        </div>
                                      </div>
                                    )
                                  )}
                                </div>
                              </>
                            )}

                            {commentsNotices[task.id] && (
                              <p className="success-message">
                                {commentsNotices[task.id]}
                              </p>
                            )}

                            <form
                              className="comment-form"
                              onSubmit={(event) =>
                                handleAddComment(event, task.id)
                              }
                            >
                              <textarea
                                rows="2"
                                maxLength="2000"
                                value={commentDrafts[task.id] || ""}
                                onChange={(event) =>
                                  setCommentDrafts((previous) => ({
                                    ...previous,
                                    [task.id]: event.target.value,
                                  }))
                                }
                                placeholder="Write a comment..."
                                aria-label={`Write a comment on ${task.title}`}
                                required
                              />
                              <div className="comment-form-footer">
                                <span>
                                  {(commentDrafts[task.id] || "").length}/2000
                                </span>
                                <button
                                  className="create-button"
                                  disabled={
                                    commentsSaving[task.id] ||
                                    !(commentDrafts[task.id] || "").trim()
                                  }
                                >
                                  {commentsSaving[task.id]
                                    ? "Sending..."
                                    : "Post comment"}
                                </button>
                              </div>
                            </form>
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
