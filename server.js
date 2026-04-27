const express = require("express");
const db = require("./database");
const studentRoutes = require("./routes/student");
const adminRoutes = require("./routes/admin");

const app = express();
app.use(express.json());

// Routes
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("Student Project Submission API is running!");
});

app.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
