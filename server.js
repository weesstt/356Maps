const fs = require("fs");
const express = require("express");
const sharp = require("sharp");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const UserModel = require("./models/users.js");
const UserController = require("./controllers/UserController.js");
const nodemailer = require("nodemailer");
const morgan = require("morgan");

var sessions = require("express-session");
const secret = process.argv[2];

const app = express();
const mongoDB = "mongodb://127.0.0.1:27017/356Maps";
var db;
const cors = require("cors");

if (process.argv.length !== 3) {
    console.log("Incorrect number of arguments!");
    console.log("Correct Usage: node server.js <SessionSecretKey>");
    process.exit(0);
}

const server = app.listen(80, () => {
    mongoose.connect(mongoDB, {});
    db = mongoose.connection;
    db.on("error", console.error.bind(console, "MongoDB connection error"));
});

const mailTransport = nodemailer.createTransport({
    service: "postfix",
    host: "localhost",
    secure: false,
    port: 25,
    auth: { user: "root@cse356.compas.cs.stonybrook.edu", pass: "" },
    tls: { rejectUnauthorized: false },
});

process.on("SIGINT", () => {
    server.close(() => {
        db.close();
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

//Session Middleware
app.use(
    sessions({
        secret: secret,
        resave: false,
        saveUninitialized: false,
        name: "session",
        cookie: {},
        store: MongoStore.create({
            mongoUrl: mongoDB,
        }),
    })
);

//Header group id middleware
app.use((req, res, next) => {
    res.setHeader("X-CSE356", "65bae34dc5cd424f68b46147");
    next();
});

// request logging middleware
app.use(morgan("tiny"));

app.post("/api/adduser", (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const emailURLEncode = req.body.email.replace("+", "%2B");
    const password = req.body.password;

    if (username.length === 0 || email.length === 0 || password.length === 0) {
        res.send({ status: "ERROR", errorMsg: "Missing arguments!" });
        return;
    }

    UserController.createUser(username, email, password)
        .then((verifyKey) => {
            let mailOptions = {
                from: "warmup2@cse356.compas.cs.stonybrook.edu",
                to: email,
                subject:
                    "Welcome to Warm Up Project 2, please verify your account.",
                text:
                    "Thank you for signing up for warm up project 2. Please click the link below to verify your account and sign in.\n" +
                    "http://green.cse356.compas.cs.stonybrook.edu/api/verify?email=" +
                    emailURLEncode +
                    "&key=" +
                    verifyKey,
            };

            mailTransport.sendMail(mailOptions, (error, info) => {
                if (error) {
                    res.send({ status: "ERROR", errorMsg: error });
                } else {
                    res.send({ status: "ok" });
                }
            });
        })
        .catch((error) => {
            res.send({ status: "ERROR", errorMsg: error });
        });
});

app.get("/api/verify", (req, res) => {
    if (req.query.email !== undefined && req.query.key !== undefined) {
        const email = req.query.email;
        const key = req.query.key;
        console.log(key);
        UserController.verifyUser(email, key)
            .then((success) => {
                res.send({ status: "ok" });
            })
            .catch((error) => {
                res.send({ status: "ERROR", errorMsg: error });
            });
    } else {
        res.send({ status: "ERROR", errorMsg: "Missing email or key" });
    }
});

app.post("/api/login", (req, res) => {
    const username = req.body.username;
    const password = req.body.password;

    UserController.checkLogin(username, password)
        .then(() => {
            req.session.loggedIn = true;
            req.session.user = username;
            res.send({ status: "ok" });
        })
        .catch((error) => {
            res.send({ status: "ERROR", errorMsg: error.message });
        });
});

app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            res.send({ status: "ERROR", errorMsg: err.message });
        }
        res.clearCookie("session");
        res.send({ status: "ok" });
    });
});

app.get("/api/user", (req, res) => {
    if (req.session.loggedIn) {
        res.send({ loggedin: true, username: req.session.user });
    } else {
        res.send({ status: "ERROR", errorMsg: "Not logged in" });
    }
});