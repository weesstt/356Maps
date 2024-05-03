const cluster = require("cluster");

if (cluster.isMaster) {
    console.log(`Master: ${process.pid}`);

    // Cores
    for (let i = 0; i < 8; i++) {
        cluster.fork();
    }

    cluster.on("exit", (worker, code, signal) => {
        console.log(`M: worker ${worker.process.pid} dead`);
    });
} else {
    const express = require("express");
    const sharp = require("sharp");
    const mongoose = require("mongoose");
    const MongoStore = require("connect-mongo");
    const UserController = require("./controllers/UserController.js");
    const nodemailer = require("nodemailer");
    const { Readable } = require("stream");
    const fetch = require("node-fetch");
    const morgan = require("morgan");

    var sessions = require("express-session");
    const secret = process.argv[2];
    var ctr = 0;
    var rctr = 0;

    const app = express();
    const mongoDB = process.argv[3];
    var db;
    const cors = require("cors");

    const server = app.listen(3000, () => {
        if (process.argv.length !== 4) {
            server.close(() => {
                console.log("Incorrect number of arguments!");
                console.log(
                    "Correct Usage: node server.js <SessionSecretKey> <mongoatlasdb>"
                );
                process.exit(0);
            });
        }
        console.log(`Worker ${process.pid} started`);
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
        console.log(`Worker ${process.pid} closed`);
        server.close(() => {
            db.close();
            process.exit(0);
        });
    });

    process.on("SIGBREAK", () => {
        ctr = 0;
        rctr = 0;
    });

    app.use(
        cors({
            origin: "http://localhost:3000",
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
    // app.use(morgan("tiny"));

    app.get("/", (req, res) => {
        if (!req.session.loggedIn) {
            res.sendFile(__dirname + "/log-in.html");
        } else {
            res.sendFile(__dirname + "/index.html");
        }
    });

    app.get("/index.html", (req, res) => {
        if (!req.session.loggedIn) {
            res.sendFile(__dirname + "/log-in.html");
        } else {
            res.sendFile(__dirname + "/index.html");
        }
    });

    app.get("/index.css", (req, res) => {
        res.sendFile(__dirname + "/index.css");
    });

    app.get("/index.js", (req, res) => {
        res.sendFile(__dirname + "/index.js");
    });

    app.get("/log-in.html", (req, res) => {
        res.sendFile(__dirname + "/log-in.html");
    });

    app.get("/log-in.css", (req, res) => {
        res.sendFile(__dirname + "/log-in.css");
    });

    app.get("/log-in.js", (req, res) => {
        res.sendFile(__dirname + "/log-in.js");
    });

    app.post("/api/adduser", (req, res) => {
        const username = req.body.username;
        const email = req.body.email;
        const emailURLEncode = req.body.email.replace("+", "%2B");
        const password = req.body.password;

        if (
            username.length === 0 ||
            email.length === 0 ||
            password.length === 0
        ) {
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
                console.log("Login Error: " + error.message);
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
            console.log("Logged in as: " + req.session.user);
            res.send({ loggedin: true, username: req.session.user });
        } else {
            console.log("Not logged in");
            res.send({ status: "ERROR", errorMsg: "Not logged in" });
        }
    });

    app.post("/api/search", async (req, res) => {
        const result = await fetch(`http://34.148.25.169:3000/api/search`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
        });

        res.setHeader("Content-Type", "application/json");
        result.body.pipe(res);
    });

    app.post("/api/address", async (req, res) => {
        const result = await fetch(`http://34.148.25.169:3000/api/address`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify(req.body),
        });

        res.setHeader("Content-Type", "application/json");
        result.body.pipe(res);
    });

    app.post("/convert", (req, res) => {
        const { lat, long, zoom } = req.body;
        const { xTile, yTile } = convertToTile(lat, long, zoom);
        res.json({ x_tile: xTile, y_tile: yTile });
    });

    let countTurn = 0;

    app.get("/turn/:TL/:BR.png", async (req, res) => {
        const { TL, BR } = req.params;
        const [topLat, topLon] = TL.split(",");
        const [bottomLat, bottomLon] = BR.split(",");

        const centerLat = (parseFloat(topLat) + parseFloat(bottomLat)) / 2;
        const centerLon = (parseFloat(topLon) + parseFloat(bottomLon)) / 2;
        const { xTile, yTile } = convertToTile(centerLat, centerLon, 15);

        let url;

        if (countTurn == 0) {
            url = `http://34.75.72.163/tile/15/${xTile}/${yTile}.png`;
        } else if (countTurn == 1) {
            url = `http://35.243.146.198/tile/15/${xTile}/${yTile}.png`;
        } else if (countTurn == 2) {
            url = `http://34.139.66.54/tile/15/${xTile}/${yTile}.png`;
        } else if (countTurn == 3) {
            url = `http://35.237.143.108/tile/15/${xTile}/${yTile}.png`;
        } else if (countTurn == 4) {
            url = `http://34.139.198.82/tile/15/${xTile}/${yTile}.png`;
        } else if (countTurn == 5) {
            url = `http://34.75.137.181/tile/15/${xTile}/${yTile}.png`;
        }
        countTurn = (countTurn + 1) % 6;

        const tile = await fetch(url);
        const buffer = await streamToBuffer(tile.body);
        const image = await sharp(buffer).resize(100, 100).toBuffer();
        const stream = bufferToStream(image);

        res.setHeader("Content-Type", "image/png");
        stream.pipe(res);
    });

    function convertToTile(lat, long, zoom) {
        const n = Math.pow(2, zoom);
        const xTile = Math.floor(n * ((long + 180) / 360));
        const yTile = Math.floor(
            (n *
                (1 -
                    Math.log(
                        Math.tan((lat * Math.PI) / 180) +
                            1 / Math.cos((lat * Math.PI) / 180)
                    ) /
                        Math.PI)) /
                2
        );

        return { xTile, yTile };
    }

    async function streamToBuffer(stream) {
        const chunks = [];
        for await (const chunk of stream) {
            chunks.push(chunk);
        }
        return Buffer.concat(chunks);
    }

    function bufferToStream(buffer) {
        return Readable.from(buffer);
    }
}
