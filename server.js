const fs = require("fs");
const express = require("express");
const sharp = require("sharp");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const UserModel = require("./models/users.js");
const UserController = require("./controllers/UserController.js");
const nodemailer = require('nodemailer');

var sessions = require("express-session");
const secret = process.argv[2];

const app = express();
const mongoDB = "mongodb://127.0.0.1:27017/warmup2";
var db;
const cors = require("cors");

const server = app.listen(80, () => {
    if (process.argv.length !== 3) {
        server.close(() => {
            console.log("Incorrect number of arguments!");
            console.log("Correct Usage: node server.js <SessionSecretKey>");
            process.exit(0);
        });
    }

    mongoose.connect(mongoDB, {});
    db = mongoose.connection;
    db.on("error", console.error.bind(console, "MongoDB connection error"));
});

let mailTransport = nodemailer.createTransport({
    service: 'postfix',
    host: 'localhost',
    secure: false,
    port: 25,
    auth: { user: 'root@cse356.compas.cs.stonybrook.edu', pass: '' },
    tls: { rejectUnauthorized: false }
  });

process.on("SIGINT", () => {
    server.close(() => {
        db.close();
        console.log("Server closed. Database instance disconnected.");
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
            mongoUrl: "mongodb://127.0.0.1:27017/fake_so",
        }),
    })
);

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

app.post("/adduser", (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    if (username.length === 0 || email.length === 0 || password.length === 0) {
        //redirect to home with error message
        res.send({ status: 'error', errorMsg: 'Missing arguments!' })
        return;
    }

    UserController.createUser(username, email, password)
        .then((verifyKey) => {
            let mailOptions = {
                from: 'warmup2@cse356.compas.cs.stonybrook.edu',
                to: 'austinwwest@gmail.com',
                subject: 'Welcome to Warm Up Project 2, please verify your account.',
                text: 'Thank you for signing up for warm up project 2. Please click the link below to verify your account and sign in.\n' + 'http://green.cse356.compas.cs.stonybrook.edu/verify?email=' + email + '&key=' + verifyKey
            };
            
            mailTransport.sendMail(mailOptions, (error, info) => {
            if (error) {
                res.send({ status: "error", errorMsg: error });
            } else {
                res.send({ status: "success" });
                res.redirect("/?success='Successfully signed up, please check your email to verify your account.'");
            }
            });
        })
        .catch((error) => {
            res.send({ status: "error", errorMsg: error });
        });
});

app.get("/verify", (req, res) => {
    if (req.query.email !== undefined && req.query.key !== undefined){
        const email = req.query.email;
        const key = req.query.key; 
        console.log(key);
        UserController.verifyUser(email, key).then((success) => {
            res.send({ status: 'success' });
        }).catch((error) => {
            res.send({ status: 'error', errorMsg: error })
        })
    } else {
        res.send({status: 'error', errorMsg: 'Missing email or key'});
    }
})

app.get("/tiles/l:layer/:v/:h.jpg", (req, res) => {
    const { layer, v, h } = req.params;
    const style = req.query.style;
    const path = __dirname + `/tiles/l${layer}/${v}/${h}.jpg`;

    if (style === "color") res.sendFile(path);
    else if (style === "bw") {
        sharp(path)
            .grayscale()
            .toBuffer((err, data, info) => {
                if (err) {
                    res.send("Not Found");
                } else {
                    res.set("Content-Type", "image/jpeg");
                    res.send(data);
                }
            });
    } else res.send("Not Found");
});
