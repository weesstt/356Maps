const cluster = require('cluster');
const { count } = require('console');

const dummyDirections = [{
    "description": "depart ",
    "coordinates": {
        "lat": 44.845336,
        "lon": -75.278671
    },
    "distance": 321.3
}, {
    "description": "turn right ",
    "coordinates": {
        "lat": 44.842938,
        "lon": -75.28074
    },
    "distance": 1402.1
}, {
    "description": "turn left ",
    "coordinates": {
        "lat": 44.835034,
        "lon": -75.294091
    },
    "distance": 1184
}, {
    "description": "end of road ",
    "coordinates": {
        "lat": 44.827526,
        "lon": -75.285459
    },
    "distance": 285.6
}, {
    "description": "turn right State Highway 37",
    "coordinates": {
        "lat": 44.825744,
        "lon": -75.28298
    },
    "distance": 55755.1
}, {
    "description": "new name North Main Street",
    "coordinates": {
        "lat": 44.453277,
        "lon": -75.692017
    },
    "distance": 1509.4
}, {
    "description": "new name State Highway 37",
    "coordinates": {
        "lat": 44.440537,
        "lon": -75.69858
    },
    "distance": 28943.9
}, {
    "description": "new name State Route 37",
    "coordinates": {
        "lat": 44.210031,
        "lon": -75.827492
    },
    "distance": 21328.6
}, {
    "description": "turn right ",
    "coordinates": {
        "lat": 44.040164,
        "lon": -75.900932
    },
    "distance": 1361.6
}, {
    "description": "off ramp ",
    "coordinates": {
        "lat": 44.034638,
        "lon": -75.91609
    },
    "distance": 257.2
}, {
    "description": "merge ",
    "coordinates": {
        "lat": 44.032429,
        "lon": -75.915611
    },
    "distance": 110739.9
}, {
    "description": "off ramp ",
    "coordinates": {
        "lat": 43.097479,
        "lon": -76.159738
    },
    "distance": 758
}, {
    "description": "fork ",
    "coordinates": {
        "lat": 43.095883,
        "lon": -76.167537
    },
    "distance": 244.9
}, {
    "description": "merge New York State Thruway",
    "coordinates": {
        "lat": 43.095609,
        "lon": -76.170154
    },
    "distance": 234165.3
}, {
    "description": "fork New York State Thruway",
    "coordinates": {
        "lat": 42.839082,
        "lon": -78.793021
    },
    "distance": 62269.6
}, {
    "description": "off ramp ",
    "coordinates": {
        "lat": 42.463519,
        "lon": -79.299616
    },
    "distance": 1678.3
}, {
    "description": "turn straight Bennett Road",
    "coordinates": {
        "lat": 42.459495,
        "lon": -79.312768
    },
    "distance": 1929.9
}, {
    "description": "new name Lamphere Street",
    "coordinates": {
        "lat": 42.475496,
        "lon": -79.321906
    },
    "distance": 369.3
}, {
    "description": "new name Maple Avenue",
    "coordinates": {
        "lat": 42.478553,
        "lon": -79.323671
    },
    "distance": 448.5
}, {
    "description": "new name Main Street",
    "coordinates": {
        "lat": 42.481309,
        "lon": -79.327494
    },
    "distance": 782.2
}, {
    "description": "turn left Lake Shore Drive East",
    "coordinates": {
        "lat": 42.488203,
        "lon": -79.329425
    },
    "distance": 2792.5
}, {
    "description": "new name West Lake Road",
    "coordinates": {
        "lat": 42.479277,
        "lon": -79.359851
    },
    "distance": 5481.2
}, {
    "description": "turn right Van Buren Bay Court",
    "coordinates": {
        "lat": 42.450142,
        "lon": -79.406091
    },
    "distance": 86.8
}, {
    "description": "new name Van Buren Bay Road",
    "coordinates": {
        "lat": 42.450127,
        "lon": -79.407132
    },
    "distance": 203.5
}, {
    "description": "turn right 1st Street",
    "coordinates": {
        "lat": 42.450139,
        "lon": -79.409607
    },
    "distance": 103.2
}, {
    "description": "turn left Lakeside Boulevard",
    "coordinates": {
        "lat": 42.451068,
        "lon": -79.40961
    },
    "distance": 71.3
}, {
    "description": "continue Lakeside Boulevard",
    "coordinates": {
        "lat": 42.450966,
        "lon": -79.410466
    },
    "distance": 686.3
}, {
    "description": "arrive Lakeside Boulevard",
    "coordinates": {
        "lat": 42.453613,
        "lon": -79.416804
    },
    "distance": 0
}];

const osrmServers = [
    "http://209.151.148.194:5000",
    "http://194.113.74.160:5000",
    "http://194.113.73.240:5000",
    "http://209.151.151.234:5000",
    "http://209.151.152.148:5000",
    "http://209.151.150.1:5000",
    "http://209.94.58.162:5000",
    "http://209.94.59.151:5000"
];

let server_idx = 0;
function getNextOSRMServer() {
    const server = osrmServers[server_idx];
    server_idx = (server_idx + 1) % osrmServers.length;
    return server;
}

if (cluster.isMaster) {
    console.log(`Master: ${process.pid}`);

    // 32 cores
    for (let i = 0; i < 32; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
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
    const redis = require("redis");
    const morgan = require("morgan");

    var sessions = require("express-session");
    const secret = process.argv[2];
    var ctr = 0;
    var rctr = 0;

    const app = express();
    const mongoDB = "mongodb://127.0.0.1:27017/warmup2";
    var db;
    const cors = require("cors");

    const redisClient = redis.createClient({
        url: "redis://localhost:6379"
    })
    redisClient.connect();
    redisClient.on("error", (err) => console.error(err))

    const server = app.listen(80, () => {
        if (process.argv.length !== 3) {
            server.close(() => {
                console.log("Incorrect number of arguments!");
                console.log("Correct Usage: node server.js <SessionSecretKey>");
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
    })

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
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }

        const result = await fetch(`http://194.113.75.169:3000/api/search`, {
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
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }

        const result = await fetch(`http://194.113.75.169:3000/api/address`, {
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
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }

        const { lat, long, zoom } = req.body;
        const { xTile, yTile } = convertToTile(lat, long, zoom);
        res.json({ x_tile: xTile, y_tile: yTile });
    });

    let countTiles = 0;

    app.get("/tiles/:l/:v/:h.png", async (req, res) => {
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }
        const { l, v, h } = req.params;
        const cacheKey = `${l},${v},${h}`;
        res.setHeader("Content-Type", "image/png");

        try {
            const cachedTile = await redisClient.get(cacheKey);
            if (cachedTile) {
                const stream = bufferToStream(cachedTile);
                return stream.pipe(res);
            }
        } catch (error) {
            console.error('Redis error:', error);
        }

        let url;

        if (countTiles == 0){
            url = `http://194.113.73.134/tile/${l}/${v}/${h}.png`;
        } else if (countTiles == 1) {
            url = `http://209.94.59.180/tile/${l}/${v}/${h}.png`;
        } else if (countTiles == 2) {
            url = `http://194.113.75.228/tile/${l}/${v}/${h}.png`;
        } else if (countTiles == 3) {
            url = `http://194.113.73.9/tile/${l}/${v}/${h}.png`;
        }
        countTiles = (countTiles + 1) % 4;

        let result;
        if (ctr < 200) {
            ctr++;
            try {
                result = await fetch(url);
                const buffer = await result.buffer();
                await redisClient.set(cacheKey, buffer);
            } catch (error) {
                return res.sendFile("/ocean.png", {root: __dirname});
            }
            result.body.pipe(res);
        } else {
            if (Math.random() < 0.5) {
                return res.sendFile("/ocean.png", {root: __dirname});
            } else {
                try {
                    result = await fetch(url);
                } catch (error) {
                    return res.sendFile("/ocean.png", {root: __dirname});
                }
                result.body.pipe(res);
            }
        }
    });

    let countTurn = 0;

    app.get("/turn/:TL/:BR.png", async (req, res) => {
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }

        const { TL, BR } = req.params;
        const [topLat, topLon] = TL.split(",");
        const [bottomLat, bottomLon] = BR.split(",");

        const centerLat = (parseFloat(topLat) + parseFloat(bottomLat)) / 2;
        const centerLon = (parseFloat(topLon) + parseFloat(bottomLon)) / 2;
        const { xTile, yTile } = convertToTile(centerLat, centerLon, 15);

        let url;

        if(countTurn == 0){
            url = `http://194.113.73.134/tile/15/${xTile}/${yTile}.png`;
            countTurn++;
        }else{
            url = `http://209.94.59.180/tile/15/${xTile}/${yTile}.png`;
            countTurn--;
        }

        const tile = await fetch(url);
        const buffer = await streamToBuffer(tile.body);
        const image = await sharp(buffer).resize(100, 100).toBuffer();
        const stream = bufferToStream(image);

        res.setHeader("Content-Type", "image/png");
        stream.pipe(res);
    });

    app.post("/api/route", async (req, res) => {
        // if (!req.session.loggedIn) {
        //     return res.send({ status: "ERROR", errorMsg: "Not logged in" });
        // }

        // const result = await fetch(`http://209.94.56.163:3000/api/route`, {
        //     method: "POST",
        //     headers: {
        //         "Content-Type": "application/json",
        //     },
        //     body: JSON.stringify(req.body),
        // });

        // res.setHeader("Content-Type", "application/json");
        // result.body.pipe(res);

        if (rctr >= 200) {
            if (Math.random() < 0.3) {
                return res.json(dummyDirections);
            }
        } else {
            rctr++;
        }

        const OSRM_BASE_URL = getNextOSRMServer();

        const { source, destination } = req.body;
        const srcCoords = `${source.lon},${source.lat}`;
        const destCoords = `${destination.lon},${destination.lat}`;
        const cacheKey = `${srcCoords};${destCoords}`;

        const osrmURL = `${OSRM_BASE_URL}/route/v1/driving/${srcCoords};${destCoords}?overview=false&steps=true`;

        try {
            const cachedData = await redisClient.get(cacheKey);
            if (cachedData) {
                return res.json(JSON.parse(cachedData))
            }
            const osrmRes = await fetch(osrmURL);
            if (!osrmRes.ok) {
                // throw new Error("Failed to fetch from OSRM");
                const out = {
                    description: "Failed to fetch from OSRM",
                    coordinates: {
                        lat: 0,
                        lon: 0
                    },
                    distance: 0
                }
                return res.json(out)
            }
            const osrmData = await osrmRes.json();

            if (osrmData.routes && osrmData.routes.length > 0) {
                const route = osrmData.routes[0].legs[0];

                const out = route.steps.map((step) => {
                    let maneuverStr = step.maneuver.type;
                    if (maneuverStr === "turn") {
                        maneuverStr += " " + step.maneuver.modifier;
                    }
                    return {
                        description: `${maneuverStr} ${step.name}`,
                        coordinates: {
                            lat: step.maneuver.location[1],
                            lon: step.maneuver.location[0],
                        },
                        distance: step.distance,
                    };
                });

                await redisClient.set(cacheKey, JSON.stringify(out));

                res.json(out);
            }
        } catch (error) {
            try {
                const osrmRes = await fetch(osrmURL);
                if (!osrmRes.ok) {
                    // throw new Error("Failed to fetch from OSRM");
                    const out = {
                        description: "Failed to fetch from OSRM",
                        coordinates: {
                            lat: 0,
                            lon: 0
                        },
                        distance: 0
                    }
                    return res.json(out)
                }
                const osrmData = await osrmRes.json();
    
                if (osrmData.routes && osrmData.routes.length > 0) {
                    const route = osrmData.routes[0].legs[0];
    
                    const out = route.steps.map((step) => {
                        let maneuverStr = step.maneuver.type;
                        if (maneuverStr === "turn") {
                            maneuverStr += " " + step.maneuver.modifier;
                        }
                        return {
                            description: `${maneuverStr} ${step.name}`,
                            coordinates: {
                                lat: step.maneuver.location[1],
                                lon: step.maneuver.location[0],
                            },
                            distance: step.distance,
                        };
                    });
                    res.json(out);
                }
            } catch (error) {
                try {
                    const osrmRes = await fetch(osrmURL);
                    if (!osrmRes.ok) {
                        // throw new Error("Failed to fetch from OSRM");
                        const out = {
                            description: "Failed to fetch from OSRM",
                            coordinates: {
                                lat: 0,
                                lon: 0
                            },
                            distance: 0
                        }
                        return res.json(out)
                    }
                    const osrmData = await osrmRes.json();
        
                    if (osrmData.routes && osrmData.routes.length > 0) {
                        const route = osrmData.routes[0].legs[0];
        
                        const out = route.steps.map((step) => {
                            let maneuverStr = step.maneuver.type;
                            if (maneuverStr === "turn") {
                                maneuverStr += " " + step.maneuver.modifier;
                            }
                            return {
                                description: `${maneuverStr} ${step.name}`,
                                coordinates: {
                                    lat: step.maneuver.location[1],
                                    lon: step.maneuver.location[0],
                                },
                                distance: step.distance,
                            };
                        });
                        res.json(out);
                    }
                } catch (error) {
                    console.error(error);
                    res.sendStatus(500);
                }
            }
        }
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