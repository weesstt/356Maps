const fs = require("fs");
const express = require("express");
const sharp = require("sharp");

const app = express();
const cors = require("cors");

const server = app.listen(80, () => {});

process.on("SIGINT", () => {
    server.close(() => {
        process.exit(0);
    });
});

app.use(
    cors({
        origin: "http://localhost:80",
        methods: ["POST", "PUT", "GET", "OPTIONS", "HEAD"],
        credentials: true,
    })
);

//Middleware to parse requests
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Header group id middleware
app.use((req, res, next) => {
    res.setHeader("X-CSE356", "65bae34dc5cd424f68b46147");
    next();
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/index.html", (req, res) => {
    res.sendFile(__dirname + "/index.html");
});

app.get("/index.css", (req, res) => {
    res.sendFile(__dirname + "/index.css");
});

app.get("/index.js", (req, res) => {
    res.sendFile(__dirname + "/index.js");
});

app.post("/api/search", (req, res) => {
    const bbox = req.body.bbox
    const onlyInBox = req.body.onlyInBox
    const searchTerm = req.body.searchTerm

    
})
