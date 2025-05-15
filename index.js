const express = require("express");
const path = require("path");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(express.json());

const dbPath = path.join(__dirname, "users.db");
let db = null;

const initializeDBAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });

    // Create users table if not exists
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        username TEXT NOT NULL,
        email TEXT NOT NULL
      );
    `);

    app.listen(3000, () => {
      console.log("Server Running at http://localhost:3000/");
    });
  } catch (e) {
    console.error(`DB Error: ${e.message}`);
    process.exit(1);
  }
};

initializeDBAndServer();

// Load users from JSONPlaceholder API and save to DB
app.get("/load", async (_req, res) => {
  try {
    const axios = require("axios");
    const { data: users } = await axios.get(
      "https://jsonplaceholder.typicode.com/users"
    );

    for (const user of users) {
      await db.run(
        `INSERT OR IGNORE INTO users (id, name, username, email) VALUES (?, ?, ?, ?)`,
        user.id,
        user.name,
        user.username,
        user.email
      );
    }
    res.sendStatus(200);
  } catch (e) {
    res.status(500).json({ error: "Failed to load users" });
  }
});

// Get all users
app.get("/users", async (_req, res) => {
  try {
    const users = await db.all("SELECT * FROM users ORDER BY id");
    res.json(users);
  } catch (e) {
    res.status(500).json({ error: "Failed to get users" });
  }
});

// Get user by id
app.get("/users/:id", async (req, res) => {
  try {
    const user = await db.get(
      "SELECT * FROM users WHERE id = ?",
      req.params.id
    );
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// Add new user
app.put("/users", async (req, res) => {
  const { id, name, username, email } = req.body;
  if (!id || !name || !username || !email) {
    return res.status(400).json({ error: "Missing user fields" });
  }
  try {
    const existingUser = await db.get("SELECT * FROM users WHERE id = ?", id);
    if (existingUser) {
      return res.status(400).json({ error: "User already exists." });
    }
    await db.run(
      `INSERT INTO users (id, name, username, email) VALUES (?, ?, ?, ?)`,
      id,
      name,
      username,
      email
    );
    const newUser = await db.get("SELECT * FROM users WHERE id = ?", id);
    res.status(201).json(newUser);
  } catch (e) {
    res.status(500).json({ error: "Failed to add user" });
  }
});

// Delete all users
app.delete("/users", async (_req, res) => {
  try {
    await db.run("DELETE FROM users");
    res.json({ message: "All users deleted" });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete users" });
  }
});

// Delete user by id
app.delete("/users/:id", async (req, res) => {
  try {
    const result = await db.run(
      "DELETE FROM users WHERE id = ?",
      req.params.id
    );
    if (result.changes === 0)
      return res.status(404).json({ error: "User not found" });
    res.json({ message: "User deleted" });
  } catch (e) {
    res.status(500).json({ error: "Failed to delete user" });
  }
});
