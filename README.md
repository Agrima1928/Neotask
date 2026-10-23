# Neotask — Collaborative Project Management System

Neotask is a web-based project management application designed to help teams organize projects, assign tasks, track progress, and collaborate efficiently in one place.

## Features

- **User Authentication:** Secure login using email and password.
- **JWT Authentication:** Token-based authentication to protect API endpoints.
- **Password Security:** Passwords are hashed using bcrypt.
- **Project Management:** Create and view projects.
- **Team Collaboration:** Manage project members.
- **Task Management:** Organize tasks and track their progress.
- **Comments:** Support collaboration through task or project discussions.
- **Role-Based Access:** Support different permissions based on user roles.

## Tech Stack

### Frontend
- React.js
- Vite
- JavaScript
- HTML
- CSS

### Backend
- Node.js
- Express.js
- JSON Web Tokens (JWT)
- bcryptjs

### Database
- PostgreSQL
- pg (Node.js PostgreSQL driver)

## Project Structure

```text
Neotask/
├── Frontend/
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/
│   ├── routes/
│   ├── db.js
│   ├── server.js
│   ├── package.json
│   └── .env
│
└── README.md
```

*Note: The folder structure may vary depending on your implementation.*

## Database Design

Neotask uses PostgreSQL to store application data.

The main tables are:

- **users:** Stores user accounts and authentication details.
- **projects:** Stores project information.
- **project_members:** Connects users with projects.
- **tasks:** Stores tasks associated with projects.
- **comments:** Stores comments for collaboration.

## Getting Started

### Prerequisites

Install the following:

- Node.js and npm
- PostgreSQL
- Git

### 1. Clone the Repository

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd Neotask
```

Replace `YOUR_GITHUB_REPOSITORY_URL` with your actual GitHub repository URL.

### 2. Configure the Backend

```bash
cd backend
npm install
```

Create a `.env` file inside the backend folder with the following variables:

```env
PORT=5000
DB_USER=your_postgres_username
DB_HOST=localhost
DB_NAME=neotask
DB_PASSWORD=your_postgres_password
DB_PORT=5432
JWT_SECRET=your_secret_key
```

Replace the example values with your local PostgreSQL credentials and a strong JWT secret.

Create the database and required tables in PostgreSQL before starting the application.

### 3. Start the Backend

```bash
npm run dev
```

The backend will run at:

http://localhost:5000

### 4. Start the Frontend

Open another terminal in the project root and run:

```bash
cd Frontend
npm install
npm run dev
```

Open the local URL displayed by Vite, usually:

http://localhost:5173

## Authentication Flow

1. The user submits their email and password.
2. The backend checks the credentials against the database.
3. bcrypt compares the submitted password with the stored password hash.
4. If authentication succeeds, the backend generates a JWT access token.
5. The frontend uses the token when accessing protected API endpoints.
6. The backend verifies the token before allowing access to protected resources.

## API

The backend exposes REST API endpoints for authentication, projects, tasks, team members, and comments.

Example authentication endpoint:

`POST /api/auth/login`

Protected endpoints require a valid access token according to the application's authentication middleware.

## Security

- Passwords are stored as hashes rather than plain text.
- JWT authentication protects authorized API operations.
- Database credentials and JWT secrets are configured through environment variables.
- The `.env` file should not be committed to GitHub.

## Future Enhancements

- Task deadlines and reminders.
- Improved project analytics and progress dashboards.
- Real-time team collaboration.
- Enhanced role and permission management.

## Author

Developed as a collaborative project management application using the MERN-style JavaScript ecosystem with PostgreSQL as the database.
