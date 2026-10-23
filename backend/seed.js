
require("dotenv").config();

const bcrypt = require("bcryptjs");
const pool = require("./db");

const demoUsers = [
  {
    name: "Demo Admin",
    email: "admin@neostats.local",
    password: "Admin@12345",
    role: "admin",
  },
  {
    name: "Demo Manager",
    email: "manager@neostats.local",
    password: "Manager@12345",
    role: "project_manager",
  },
  {
    name: "Demo Team Member",
    email: "member@neostats.local",
    password: "Member@12345",
    role: "team_member",
  },
  {
    name: "Demo Viewer",
    email: "viewer@neostats.local",
    password: "Viewer@12345",
    role: "viewer",
  },
];

async function seedUsers() {
  try {
    for (const user of demoUsers) {
      const passwordHash = await bcrypt.hash(user.password, 10);

      await pool.query(
        `INSERT INTO users (name, email, password_hash, role)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email)
         DO UPDATE SET
           name = EXCLUDED.name,
           password_hash = EXCLUDED.password_hash,
           role = EXCLUDED.role`,
        [
          user.name,
          user.email,
          passwordHash,
          user.role,
        ]
      );

      console.log(`Created or updated: ${user.email}`);
    }

    console.log("Demo users are ready!");
  } catch (error) {
    console.error("Seeding failed:", error.message);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

seedUsers();
