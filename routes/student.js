const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const db = require("../database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const SECRET = "@k2n+_25wins";

// ── Auth middleware ──────────────────────────────────────────────────────────
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token =
    authHeader && authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : authHeader;

  if (!token) return res.status(401).json({ error: "No token provided" });

  try {
    const decoded = jwt.verify(token, SECRET);
    if (decoded.role !== "student") {
      return res.status(403).json({ error: "Access denied" });
    }
    req.student = decoded;
    next();
  } catch {
    res.status(401).json({ error: "Invalid token" });
  }
};

// ── File upload config ───────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: "./uploads/",
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (path.extname(file.originalname) !== ".zip") {
      return cb(new Error("Only ZIP files allowed!"));
    }
    cb(null, true);
  },
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Routes ───────────────────────────────────────────────────────────────────

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Student project submission endpoints
 */

/**
 * @swagger
 * /api/student/register:
 *   post:
 *     summary: Register a new student account
 *     tags: [Student]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               email:
 *                 type: string
 *                 example: john@example.com
 *               password:
 *                 type: string
 *                 example: mypassword123
 *     responses:
 *       201:
 *         description: Student registered successfully
 *       400:
 *         description: Username or email already exists
 */
router.post("/register", async (req, res) => {
  const { username, email, password } = req.body;

  if (!username || !email || !password) {
    return res
      .status(400)
      .json({ error: "username, email and password are required" });
  }

  const hashed = await bcrypt.hash(password, 10);

  try {
    db.prepare(
      "INSERT INTO students (username, email, password) VALUES (?, ?, ?)",
    ).run(username, email, hashed);
    res.status(201).json({ message: "Student registered successfully!" });
  } catch {
    res.status(400).json({ error: "Username or email already exists" });
  }
});

/**
 * @swagger
 * /api/student/login:
 *   post:
 *     summary: Student login — returns JWT token
 *     tags: [Student]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - password
 *             properties:
 *               username:
 *                 type: string
 *                 example: john_doe
 *               password:
 *                 type: string
 *                 example: mypassword123
 *     responses:
 *       200:
 *         description: Login successful, returns token and role
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *                 role:
 *                   type: string
 *       401:
 *         description: Wrong password
 *       404:
 *         description: Student not found
 */
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res
      .status(400)
      .json({ error: "username and password are required" });
  }

  const student = db
    .prepare("SELECT * FROM students WHERE username = ?")
    .get(username);

  if (!student) return res.status(404).json({ error: "Student not found" });

  const match = await bcrypt.compare(password, student.password);
  if (!match) return res.status(401).json({ error: "Wrong password" });

  const token = jwt.sign(
    {
      id: student.id,
      username: student.username,
      email: student.email,
      role: "student",
    },
    SECRET,
    { expiresIn: "1d" },
  );

  res.json({ message: "Login successful!", token, role: "student" });
});

/**
 * @swagger
 * /api/student/submit:
 *   post:
 *     summary: Submit a project (requires student login)
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - project_title
 *               - zipfile
 *             properties:
 *               project_title:
 *                 type: string
 *                 example: My Awesome Project
 *               zipfile:
 *                 type: string
 *                 format: binary
 *                 description: ZIP file of the project (max 50MB)
 *     responses:
 *       201:
 *         description: Project submitted successfully
 *       400:
 *         description: Missing required fields or file
 *       401:
 *         description: Unauthorized
 */
router.post("/submit", authMiddleware, upload.single("zipfile"), (req, res) => {
  const { project_title } = req.body;
  const student_name = req.student.username;
  const student_email = req.student.email;

  if (!project_title) {
    return res.status(400).json({ error: "Project title is required" });
  }

  if (!req.file) {
    return res.status(400).json({ error: "ZIP file is required" });
  }

  db.prepare(
    `INSERT INTO submissions (student_name, student_email, project_title, file_path, file_size)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(
    student_name,
    student_email,
    project_title,
    req.file.path,
    req.file.size,
  );

  res.status(201).json({ message: "Project submitted successfully!" });
});

/**
 * @swagger
 * /api/student/status:
 *   get:
 *     summary: Check your own submission statuses (requires student login)
 *     tags: [Student]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of your submissions
 *       404:
 *         description: No submissions found
 *       401:
 *         description: Unauthorized
 */
router.get("/status", authMiddleware, (req, res) => {
  const submissions = db
    .prepare(
      `SELECT id, project_title, status, admin_note, submitted_at
       FROM submissions WHERE student_email = ?`,
    )
    .all(req.student.email);

  if (submissions.length === 0) {
    return res.status(404).json({ error: "No submissions found" });
  }

  res.json(submissions);
});

module.exports = router;
