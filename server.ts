import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("calorify.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password TEXT,
    name TEXT,
    age INTEGER,
    gender TEXT,
    height REAL,
    weight REAL,
    bio TEXT,
    goal TEXT DEFAULT 'maintenance',
    daily_target INTEGER DEFAULT 2000
  );

  CREATE TABLE IF NOT EXISTS food_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    food_name TEXT,
    calories INTEGER,
    protein REAL,
    carbs REAL,
    fats REAL,
    image_data TEXT,
    health_indicator TEXT,
    reasoning TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // API Routes
  app.post("/api/auth/signup", (req, res) => {
    const { email, password } = req.body;
    try {
      const info = db.prepare("INSERT INTO users (email, password) VALUES (?, ?)").run(email, password);
      res.json({ id: info.lastInsertRowid, email });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { email, password } = req.body;
    const user = db.prepare("SELECT * FROM users WHERE email = ? AND password = ?").get(email, password);
    if (user) {
      res.json(user);
    } else {
      res.status(401).json({ error: "Invalid credentials" });
    }
  });

  app.get("/api/user/:id", (req, res) => {
    const user = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    res.json(user);
  });

  app.put("/api/user/:id", (req, res) => {
    const { name, age, gender, height, weight, bio, goal, daily_target } = req.body;
    db.prepare(`
      UPDATE users SET 
        name = ?, age = ?, gender = ?, height = ?, weight = ?, bio = ?, goal = ?, daily_target = ?
      WHERE id = ?
    `).run(name, age, gender, height, weight, bio, goal, daily_target, req.params.id);
    res.json({ success: true });
  });

  app.get("/api/logs/:userId", (req, res) => {
    const logs = db.prepare("SELECT * FROM food_logs WHERE user_id = ? ORDER BY created_at DESC").all(req.params.userId);
    res.json(logs);
  });

  app.post("/api/logs", (req, res) => {
    const { user_id, food_name, calories, protein, carbs, fats, image_data, health_indicator, reasoning } = req.body;
    const info = db.prepare(`
      INSERT INTO food_logs (user_id, food_name, calories, protein, carbs, fats, image_data, health_indicator, reasoning)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(user_id, food_name, calories, protein, carbs, fats, image_data, health_indicator, reasoning);
    res.json({ id: info.lastInsertRowid });
  });

  app.delete("/api/logs/:id", (req, res) => {
    db.prepare("DELETE FROM food_logs WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
