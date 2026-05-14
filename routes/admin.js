const express = require("express");
const router = express.Router();
const db = require("../database");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const path = require("path");
const fs = require("fs");

const SECRET = "mysecretkey123";

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

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin management endpoints
 */

/**
 * @swagger
 * /api/admin/register:
 *   post:
 *     summary: Register a new admin account
 *     tags: [Admin]
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
 *                 example: admin1
 *               password:
 *                 type: string
 *                 example: strongpassword123
 *     responses:
 *       200:
 *         description: Admin created successfully
 *       400:
 *         description: Username already exists
 */
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

/**
 * @swagger
 * /api/admin/login:
 *   post:
 *     summary: Admin login — returns JWT token
 *     tags: [Admin]
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
 *                 example: admin1
 *               password:
 *                 type: string
 *                 example: strongpassword123
 *     responses:
 *       200:
 *         description: Login successful, returns token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 token:
 *                   type: string
 *       401:
 *         description: Wrong password
 *       404:
 *         description: Admin not found
 */
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

/**
 * @swagger
 * /api/admin/submissions:
 *   get:
 *     summary: Get all submissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of all submissions
 *       401:
 *         description: Unauthorized
 */
router.get("/submissions", authMiddleware, (req, res) => {
  const submissions = db
    .prepare("SELECT * FROM submissions ORDER BY submitted_at DESC")
    .all();
  res.json(submissions);
});

/**
 * @swagger
 * /api/admin/download/{id}:
 *   get:
 *     summary: Download a student's ZIP file
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: ZIP file download
 *       404:
 *         description: Submission or file not found
 *       401:
 *         description: Unauthorized
 */
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

/**
 * @swagger
 * /api/admin/review/{id}:
 *   patch:
 *     summary: Update submission status and add admin note
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 example: approved
 *               admin_note:
 *                 type: string
 *                 example: Great work!
 *     responses:
 *       200:
 *         description: Submission updated
 *       401:
 *         description: Unauthorized
 */
router.patch("/review/:id", authMiddleware, (req, res) => {
  const { status, admin_note } = req.body;
  db.prepare(
    "UPDATE submissions SET status = ?, admin_note = ? WHERE id = ?",
  ).run(status, admin_note, req.params.id);
  res.json({ message: "Submission updated!" });
});

/**
 * @swagger
 * /api/admin/submissions/{id}:
 *   delete:
 *     summary: Delete a submission
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: Submission deleted
 *       401:
 *         description: Unauthorized
 */
router.delete("/submissions/:id", authMiddleware, (req, res) => {
  db.prepare("DELETE FROM submissions WHERE id = ?").run(req.params.id);
  res.json({ message: "Submission deleted!" });
});

module.exports = router;
