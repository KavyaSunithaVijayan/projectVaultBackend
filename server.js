const express = require("express");
const db = require("./database");
const studentRoutes = require("./routes/student");
const adminRoutes = require("./routes/admin");
const swaggerUi = require("swagger-ui-express");
const swaggerJsdoc = require("swagger-jsdoc");

const app = express();
app.use(express.json());

// Swagger config
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Student Project Submission API",
      version: "1.0.0",
      description: "API for submitting and managing student projects",
    },
    servers: [
      {
        url: "https://projectvaultbackend-iysa.onrender.com",
        description: "Production server",
      },
      {
        url: "http://localhost:3000",
        description: "Local server",
      },
    ],
  },
  apis: ["./routes/*.js"], // reads JSDoc comments from your route files
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI at "/"
app.use("/", swaggerUi.serve);
app.get("/", swaggerUi.setup(swaggerSpec));

// Routes
app.use("/api/student", studentRoutes);
app.use("/api/admin", adminRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
