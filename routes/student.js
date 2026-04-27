const express = require("express");
const router = express.Router();
const multer = require("multer");
const path = require("path");
const db = require("../database");

// Multer config - save zip files to uploads folder
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
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB max
});

// POST /api/student/submit — student uploads project
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
    `
    INSERT INTO submissions (student_name, student_email, project_title, file_path, file_size)
    VALUES (?, ?, ?, ?, ?)
  `,
  ).run(
    student_name,
    student_email,
    project_title,
    req.file.path,
    req.file.size,
  );

  res.status(201).json({ message: "Project submitted successfully!" });
});

// GET /api/student/status/:email — student checks their submission
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
