const functions = require("firebase-functions");
const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("API Working");
});

app.get("/users", (req, res) => {
  res.json([
    {id: 1, name: "Kavya"},
    {id: 2, name: "Arun"},
  ]);
});

exports.api = functions.https.onRequest(app);
