const fs = require("fs");
const express = require("express");
const sharp = require("sharp");
const mongoose = require("mongoose");
const MongoStore = require("connect-mongo");
const bcrypt = require("bcrypt");
const UserModel = require("./models/users.js");
const UserController = require("./controllers/UserController.js");
const nodemailer = require("nodemailer");
const { Pool } = require("pg");
const { Readable } = require("stream");

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

const pool = new Pool({
    user: "root",
    host: "localhost",
    database: "new_york",
    password: "password",
    port: 5432, // Default PostgreSQL port
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
        pool.end();
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
                    "http://green.cse356.compas.cs.stonybrook.edu/verify?email=" +
                    emailURLEncode +
                    "&key=" +
                    verifyKey,
            };

            mailTransport.sendMail(mailOptions, (error, info) => {
                if (error) {
                    res.send({ status: "ERROR", errorMsg: error });
                } else {
                    res.send({ status: "success" });
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
                res.send({ status: "success" });
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
            res.send({ status: "OK" });
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
        res.send({ status: "OK" });
    });
});

app.get("/api/user", (req, res) => {
    if (req.session.loggedIn) {
        res.send({ loggedin: true, username: req.session.user });
    } else {
        res.send({ status: "ERROR", errorMsg: "Not logged in" });
    }
});

app.post("/api/search", (req, res) => {
    const bbox = req.body.bbox;
    const onlyInBox = req.body.onlyInBox;

    const searchSet = {};
    const searchTerm = req.body.searchTerm;
    let queryParams = [`%${searchTerm}%`];
    for (const word of searchTerm.toLowerCase().split(" ")) {
        searchSet[word] = true;
    }

    var pointQuery =
        "SELECT p.*, ST_X(ST_Transform(p.way, 4326)) AS longitude, ST_Y(ST_Transform(p.way, 4326)) AS latitude FROM planet_osm_point p " +
        "WHERE amenity IS NOT NULL AND name IS NOT NULL " +
        "AND ST_Intersects(p.way, ST_Transform(ST_SetSRID(ST_MakeEnvelope(" +
        bbox.minLon +
        ", " +
        bbox.minLat +
        ", " +
        bbox.maxLon +
        ", " +
        bbox.maxLat +
        ", 4326), 4326), 3857));";

    var polygonQuery =
        "SELECT p.*, ST_X(ST_Transform(ST_Centroid(p.way), 4326)) AS longitude, ST_Y(ST_Transform(ST_Centroid(p.way), 4326)) AS latitude FROM planet_osm_polygon p " +
        "WHERE amenity IS NOT NULL AND name IS NOT NULL " +
        "AND ST_Intersects(p.way, ST_Transform(ST_SetSRID(ST_MakeEnvelope(" +
        bbox.minLon +
        ", " +
        bbox.minLat +
        ", " +
        bbox.maxLon +
        ", " +
        bbox.maxLat +
        ", 4326), 4326), 3857));";

    var testCombinedQuery = `
        SELECT
            name,
            "addr:housenumber" AS housenumber,
            tags -> 'addr:street' AS street,
            tags -> 'addr:city' AS city,
            tags -> 'addr:state' AS state,
            tags -> 'addr:postcode' AS zip,
            ST_X(ST_Transform(way, 4326)) AS longitude, 
            ST_Y(ST_Transform(way, 4326)) AS latitude,
            ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
            ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
            ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
            ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
        FROM planet_osm_point
        WHERE
            name ILIKE $1
            OR "addr:housenumber" LIKE $1
            OR tags -> 'addr:street' ILIKE $1
            OR tags -> 'addr:postcode' LIKE $1
            AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857))

        UNION

        SELECT
            name,
            "addr:housenumber" AS housenumber,
            tags -> 'addr:street' AS street,
            tags -> 'addr:city' AS city,
            tags -> 'addr:state' AS state,
            tags -> 'addr:postcode' AS zip,
            ST_X(ST_Transform(ST_Centroid(way), 4326)) AS longitude,
            ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS latitude,
            ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
            ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
            ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
            ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
        FROM planet_osm_polygon
        WHERE
            name ILIKE $1
            OR "addr:housenumber" LIKE $1
            OR tags -> 'addr:street' ILIKE $1
            OR tags -> 'addr:postcode' LIKE $1
            AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857))

        UNION

        SELECT
            name,
            "addr:housenumber" AS housenumber,
            tags -> 'addr:street' AS street,
            tags -> 'addr:city' AS city,
            tags -> 'addr:state' AS state,
            tags -> 'addr:postcode' AS zip,
            ST_X(ST_Transform(ST_Centroid(way), 4326)) AS longitude,
            ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS latitude,
            ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
            ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
            ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
            ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
        FROM planet_osm_line
        WHERE name ILIKE $1
        AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857));
    `;

    if (onlyInBox) {
        //only get center coordinates of visible portion inside bbox
        let intersection =
            "ST_Centroid(ST_Intersection(p.way, ST_MakeEnvelope(" +
            bbox.minLon +
            ", " +
            bbox.minLat +
            ", " +
            bbox.maxLon +
            ", " +
            bbox.maxLat +
            ", 3857)))";

        polygonQuery =
            "SELECT p.*, ST_X(ST_Transform(ST_Centroid(p.way), 4326)) AS longitude, ST_Y(ST_Transform(ST_Centroid(p.way), 4326)) AS latitude, " +
            "ST_X(" +
            intersection +
            ") AS longitude, ST_Y(" +
            intersection +
            ") AS latitude FROM planet_osm_polygon p ";
        "WHERE amenity IS NOT NULL AND name IS NOT NULL " +
            "AND ST_Intersects(p.way, ST_Transform(ST_SetSRID(ST_MakeEnvelope(" +
            bbox.minLon +
            ", " +
            bbox.minLat +
            ", " +
            bbox.maxLon +
            ", " +
            bbox.maxLat +
            ", 4326), 4326), 3857));";

        testCombinedQuery = `
            SELECT
                name,
                "addr:housenumber" AS housenumber,
                tags -> 'addr:street' AS street,
                tags -> 'addr:city' AS city,
                tags -> 'addr:state' AS state,
                tags -> 'addr:postcode' AS zip,
                ST_X(ST_Transform(way, 4326)) AS longitude,
                ST_Y(ST_Transform(way, 4326)) AS latitude,
                ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
                ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
                ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
                ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
            FROM planet_osm_point
            WHERE
                (
                    name ILIKE $1
                    OR "addr:housenumber" LIKE $1
                    OR tags -> 'addr:street' ILIKE $1
                    OR tags -> 'addr:postcode' LIKE $1
                )
                AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857))

            UNION

            SELECT
                name,
                "addr:housenumber" AS housenumber,
                tags -> 'addr:street' AS street,
                tags -> 'addr:city' AS city,
                tags -> 'addr:state' AS state,
                tags -> 'addr:postcode' AS zip,
                ST_X(ST_Transform(ST_Centroid(way), 4326)) AS longitude,
                ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS latitude,
                ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
                ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
                ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
                ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
            FROM planet_osm_polygon
            WHERE
                (
                    name ILIKE $1
                    OR "addr:housenumber" LIKE $1
                    OR tags -> 'addr:street' ILIKE $1
                    OR tags -> 'addr:postcode' LIKE $1
                )
                AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857))

            UNION

            SELECT
                name,
                "addr:housenumber" AS housenumber,
                tags -> 'addr:street' AS street,
                tags -> 'addr:city' AS city,
                tags -> 'addr:state' AS state,
                tags -> 'addr:postcode' AS zip,
                ST_X(ST_Transform(ST_Centroid(way), 4326)) AS longitude,
                ST_Y(ST_Transform(ST_Centroid(way), 4326)) AS latitude,
                ST_XMin(ST_Transform(ST_Envelope(way), 4326)) AS xmin,
                ST_XMax(ST_Transform(ST_Envelope(way), 4326)) AS xmax,
                ST_YMin(ST_Transform(ST_Envelope(way), 4326)) AS ymin,
                ST_YMax(ST_Transform(ST_Envelope(way), 4326)) AS ymax
            FROM planet_osm_line
            WHERE
                name ILIKE $1
                AND ST_Within(way, ST_Transform(ST_MakeEnvelope($2, $3, $4, $5, 4326), 3857));
        `;
    }
    queryParams.push(bbox.minLon, bbox.minLat, bbox.maxLon, bbox.maxLat);

    // let pointQuery = "SELECT p.*, ST_AsText(ST_Transform(ST_Centroid(p.way), 4326)) AS center_coordinates " +
    // "FROM planet_osm_point p " +
    // "WHERE amenity IS NOT NULL AND name IS NOT NULL " +
    // "AND ST_Intersects(way, ST_Transform(ST_SetSRID(ST_MakeEnvelope(" + bbox.minLat +", " + bbox.minLon + ", " + bbox.maxLat + ", " + bbox.maxLon + ", 4326), 4326), 3857));";

    // let polygonQuery = "SELECT p.*, ST_AsText(ST_Transform(ST_Centroid(p.way), 4326)) AS center_coordinates " +
    // "FROM planet_osm_polygon p " +
    // "WHERE amenity IS NOT NULL AND name IS NOT NULL " +
    // "AND ST_Intersects(way, ST_Transform(ST_SetSRID(ST_MakeEnvelope(" + bbox.minLat +", " + bbox.minLon + ", " + bbox.maxLat + ", " + bbox.maxLon + ", 4326), 4326), 3857));";

    // if(req.body.onlyInBox == true){ //
    //     polygonQuery = "SELECT p.*, ST_AsText(ST_Transform(ST_Centroid(ST_Intersection(p.way, bbox.bbox_geom)), 4326)) AS center_coordinates " +
    //     "FROM planet_osm_polygon p JOIN (SELECT ST_Transform(ST_SetSRID(ST_MakeEnvelope(" + bbox.minLat + ", " + bbox.minLon + ", " + bbox.maxLat + ", " + bbox.maxLon + ", 4326), 4326), 3857) AS bbox_geom) AS bbox ON ST_Intersects(p.way, bbox.bbox_geom) " +
    //     "WHERE boundary IS NOT NULL AND amenity IS NOT NULL AND name IS NOT NULL;"

    //     pointQuery = "SELECT p.*, ST_AsText(ST_Transform(ST_Centroid(ST_Intersection(p.way, bbox.bbox_geom)), 4326)) AS center_coordinates " +
    //     "FROM planet_osm_point p JOIN (SELECT ST_Transform(ST_SetSRID(ST_MakeEnvelope(" + bbox.minLat + ", " + bbox.minLon + ", " + bbox.maxLat + ", " + bbox.maxLon + ", 4326), 4326), 3857) AS bbox_geom) AS bbox ON ST_Intersects(p.way, bbox.bbox_geom) " +
    //     "WHERE boundary IS NOT NULL AND amenity IS NOT NULL AND name IS NOT NULL;"
    // }

    // Execute the query
    names = new Set();

    pool.query(testCombinedQuery, queryParams)
        .then((queryResult) => {
            const resultRows = queryResult.rows;
            let out = [];
            for (const row of resultRows) {
                let outObj = {};
                outObj["coordinates"] = {
                    lat: row.latitude,
                    lon: row.longitude,
                };

                outObj["name"] = "";
                if (row.name) {
                    outObj["name"] = row.name;
                } else {
                    outObj["name"] += row.housenumber
                        ? row.housenumber + " "
                        : "";
                    outObj["name"] += row.street ? row.street + ", " : "";
                    outObj["name"] += row.city ? row.city + ", " : "";
                    outObj["name"] += row.state ? row.state + " " : "";
                    outObj["name"] += row.zip ? row.zip : "";
                }

                outObj["bbox"] = {
                    minLat: row.ymin,
                    minLon: row.xmin,
                    maxLat: row.ymax,
                    maxLon: row.xmax,
                };
                if (!names.has(outObj["name"])) {
                    out.push(outObj);
                    names.add(outObj["name"]);
                }
            }
            console.log(out);
            res.send(out);
        })
        .catch((error) => {
            res.status(500).send(error);
            console.log(error);
        });

    // pool.query(pointQuery)
    //     .then((pointResults) => {
    //         pool.query(polygonQuery)
    //             .then((polygonResults) => {
    //                 const results = [];
    //                 for (const result of pointResults.rows.concat(
    //                     polygonResults.rows
    //                 )) {
    //                     var added = false;
    //                     for (const word of result.name
    //                         .toLowerCase()
    //                         .split(" ")) {
    //                         if (word in searchSet) {
    //                             results.push(result);
    //                             added = true;
    //                             break;
    //                         }
    //                     }

    //                     if (added) continue;

    //                     for (const word of result.amenity
    //                         .toLowerCase()
    //                         .split(" ")) {
    //                         if (word in searchSet) {
    //                             results.push(result);
    //                             added = true;
    //                             break;
    //                         }
    //                     }

    //                     if (added) continue;

    //                     if (result.brand != null) {
    //                         for (const word of result.brand
    //                             .toLowerCase()
    //                             .split(" ")) {
    //                             if (word in searchSet) {
    //                                 results.push(result);
    //                                 break;
    //                             }
    //                         }
    //                     }
    //                 }
    //                 res.send(results);
    //             })
    //             .catch((error) => {
    //                 res.status(500).send(error);
    //                 console.log(error);
    //             });
    //     })
    //     .catch((error) => {
    //         res.status(500).send(error);
    //         console.log(error);
    //     });
});

app.post("/convert", (req, res) => {
    const { lat, long, zoom } = req.body;
    const { xTile, yTile } = convertToTile(lat, long, zoom);
    res.json({ xTile, yTile });
});

app.get("/tiles/:l/:v/:h.png", async (req, res) => {
    const { l, v, h } = req.params;
    const result = await fetch(`http://209.94.57.1/tile/${l}/${v}/${h}.png`);
    res.setHeader("Content-Type", "image/png");
    result.body.pipe(res);
});

app.get("/turn/:TL/:BR.png", async (req, res) => {
    const { TL, BR } = req.params;
    const [topLat, topLon] = TL.split(",");
    const [bottomLat, bottomLon] = BR.split(",");

    const centerLat = (parseFloat(topLat) + parseFloat(bottomLat)) / 2;
    const centerLon = (parseFloat(topLon) + parseFloat(bottomLon)) / 2;
    const { xTile, yTile } = convertToTile(centerLat, centerLon, 10);

    console.log(TL, BR, xTile, yTile);

    const tile = await fetch(
        `http://194.113.75.158/tile/10/${xTile}/${yTile}.png`
    );
    const buffer = await streamToBuffer(tile.body);
    const image = await sharp(buffer).resize(100, 100).toBuffer();
    const stream = bufferToStream(image);

    res.setHeader("Content-Type", "image/png");
    stream.pipe(res);
});

app.post("/api/route", async (req, res) => {
    const OSRM_BASE_URL = "http://194.113.75.9:5000";

    const { source, destination } = req.body;
    const srcCoords = `${source.lon},${source.lat}`;
    const destCoords = `${destination.lon},${destination.lat}`;

    const osrmURL = `${OSRM_BASE_URL}/route/v1/driving/${srcCoords};${destCoords}?overview=false&steps=true`;

    try {
        const osrmRes = await fetch(osrmURL);
        if (!osrmRes.ok) {
            throw new Error("Failed to fetch from OSRM");
        }
        const osrmData = await osrmRes.json();

        if (osrmData.routes && osrmData.routes.length > 0) {
            const route = osrmData.routes[0].legs[0];

            const out = route.steps.map(step => {
                return {
                    description: `${step.maneuver.type}${` ${step.maneuver.modifier}` ? step.maneuver.type === "turn" : ""} ${step.name}`,
                    coordinates: {
                        lat: step.maneuver.location[1],
                        lon: step.maneuver.location[0]
                    },
                    distance: step.distance
                };
            });

            res.json(out);
        }
    } catch (error) {
        console.error(error);
        res.sendStatus(500);
    }
})

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
