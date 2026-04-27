const express = require("express");
const router = express.Router();
const db = require("../database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const SECRET = "mysecretkey123"; // change this to something strong

// Middleware — protect admin routes
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;
  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.admin = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// POST /api/admin/register — create admin account (run once)
router.post("/register", async (req, res) => {
  const { username, password } = req.body;
  const hashed = await bcrypt.hash(password, 10);

  try {
    db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)").run(
      username,
      hashed,
    );
    res.json({ message: "Admin created!" });
  } catch {
    res.status(400).json({ error: "Username already exists" });
  }
});

// POST /api/admin/login — admin login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;
  const admin = db
    .prepare("SELECT * FROM admins WHERE username = ?")
    .get(username);

  if (!admin) return res.status(404).json({ error: "Admin not found" });

  const match = await bcrypt.compare(password, admin.password);
  if (!match) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign({ id: admin.id, username }, SECRET, {
    expiresIn: "1d",
  });
  res.json({ message: "Login successful!", token });
});

// GET /api/admin/submissions — get all submissions
router.get("/submissions", authMiddleware, (req, res) => {
  const submissions = db
    .prepare("SELECT * FROM submissions ORDER BY submitted_at DESC")
    .all();
  res.json(submissions);
});

// GET /api/admin/download/:id — download student zip
router.get("/download/:id", authMiddleware, (req, res) => {
  const submission = db
    .prepare("SELECT * FROM submissions WHERE id = ?")
    .get(req.params.id);
  if (!submission)
    return res.status(404).json({ error: "Submission not found" });

  const filePath = path.resolve(submission.file_path);
  if (!fs.existsSync(filePath))
    return res.status(404).json({ error: "File not found on server" });

  res.download(filePath);
});

// PATCH /api/admin/review/:id — update status and add note
router.patch("/review/:id", authMiddleware, (req, res) => {
  const { status, admin_note } = req.body;

  db.prepare(
    "UPDATE submissions SET status = ?, admin_note = ? WHERE id = ?",
  ).run(status, admin_note, req.params.id);

  res.json({ message: "Submission updated!" });
});

// DELETE /api/admin/submissions/:id — delete a submission
router.delete("/submissions/:id", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM submissions WHERE id = ?").run(req.params.id);
  res.json({ message: "Submission deleted!" });
});

module.exports = router;
