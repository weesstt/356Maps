const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const UserController = require("./controllers/UserController.js");
const nodemailer = require("nodemailer");

var sessions = require("express-session");
const secret = process.argv[2];
var ctr = 0;
var rctr = 0;

const app = express();
const mongoDB = process.argv[3]
var db;
const cors = require("cors");

const server = app.listen(80, () => {
    if (process.argv.length !== 4) {
        server.close(() => {
            console.log("Incorrect number of arguments!");
            console.log("Correct Usage: node server.js <SessionSecretKey> <mongoatlasdb>");
            process.exit(0);
        });
    }
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