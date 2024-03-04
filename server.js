const express = require("express");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const UserModel = require("./models/users.js");
const UserController = require("./controllers/UserController.js");

var sessions = require("express-session");
const secret = process.argv[2];

const app = express();
const mongoDB = "mongodb://127.0.0.1:27017/warmup2"
var db;
const cors = require("cors");

const server = app.listen(80, () => {
    if(process.argv.length !== 3){
        server.close(() => {
            console.log("Incorrect number of arguments!");
            console.log("Correct Usage: node server.js <SessionSecretKey>");
            process.exit(0);
        })
    }

    mongoose.connect(mongoDB, {});//{useNewUrlParser: true, useUnifiedTopology: true} deprecated?
    db = mongoose.connection;
    db.on("error", console.error.bind(console, "MongoDB connection error"));
})

process.on("SIGINT", () => {
    server.close(() => {
        db.close()
        console.log("Server closed. Database instance disconnected.");
        process.exit(0)
    })
})

app.use(cors({
    origin: "http://localhost:80",
    methods: ['POST', 'PUT', 'GET', 'OPTIONS', 'HEAD'],
    credentials: true
  }));

//Middleware to parse requests
app.use(express.json());
app.use(express.urlencoded({extended: true}));

//Session Middleware
app.use(
    sessions({
      secret: secret,
      resave: false,
      saveUninitialized: false,
      name: "session",
      cookie: {},
      store: MongoStore.create({ mongoUrl: 'mongodb://127.0.0.1:27017/fake_so'})
    })
);

//Header group id middleware
app.use((req, res, next) => {
    res.setHeader('X-CSE356', '65bae34dc5cd424f68b46147');
    next();
});

app.get("/", (req, res) => {
    res.sendFile(__dirname + "/index.html");
})

app.get("/index.html", (req, res) => {
    res.sendFile(__dirname + "/index.html");
})

app.get("/index.css", (req, res) => {
    res.sendFile(__dirname + "/index.css");
})

app.post("/adduser", (req, res) => {
    const username = req.body.username;
    const email = req.body.email;
    const password = req.body.password;

    if(username.length === 0 || email.length === 0 || password.length === 0){
        //redirect to home with error message
    }

    UserController.createUser(username, email, password).then((verifyKey) => {
        res.send({status: "success"})
    }).catch((error) => {
        res.status(400).send({status: "error", errorMsg: error})
    })
})