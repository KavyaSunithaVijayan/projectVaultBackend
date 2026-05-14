const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const db = require("../database");

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

/**
 * @swagger
 * tags:
 *   name: Student
 *   description: Student project submission endpoints
 */

/**
 * @swagger
 * /api/student/submit:
 *   post:
 *     summary: Submit a student project
 *     tags: [Student]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - student_name
 *               - student_email
 *               - project_title
 *               - zipfile
 *             properties:
 *               student_name:
 *                 type: string
 *                 example: John Doe
 *               student_email:
 *                 type: string
 *                 example: john@example.com
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project submitted successfully!
 *       400:
 *         description: Missing required fields or file
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 */
router.post("/submit", upload.single("zipfile"), (req, res) => {
  const { student_name, student_email, project_title } = req.body;

  if (!student_name || !student_email || !project_title) {
    return res
      .status(400)
      .json({ error: "Name, email and project title are required" });
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
 * /api/student/status/{email}:
 *   get:
 *     summary: Check submission status by email
 *     tags: [Student]
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *         example: john@example.com
 *     responses:
 *       200:
 *         description: List of submissions for the email
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: integer
 *                   project_title:
 *                     type: string
 *                   status:
 *                     type: string
 *                   admin_note:
 *                     type: string
 *                   submitted_at:
 *                     type: string
 *       404:
 *         description: No submissions found for this email
 */
router.get("/status/:email", (req, res) => {
  const submissions = db
    .prepare(
      "SELECT id, project_title, status, admin_note, submitted_at FROM submissions WHERE student_email = ?",
    )
    .all(req.params.email);

  if (submissions.length === 0) {
    return res
      .status(404)
      .json({ error: "No submissions found for this email" });
  }

  res.json(submissions);
});

module.exports = router;
