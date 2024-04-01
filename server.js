const fs = require("fs");
const express = require("express");
const sharp = require("sharp");
const { Pool } = require("pg");

const app = express();
const cors = require("cors");

const server = app.listen(80, () => {});

const pool = new Pool({
    user: "root",
    host: "localhost",
    database: "postgres",
    password: "password",
    port: 5432, // Default PostgreSQL port
});

process.on("SIGINT", () => {
    server.close(() => {
        pool.end();
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

app.get("/tiles/l:layer/:v/:h.png", async (req, res) => {
    const { layer, v, h } = req.params;
    const result = await fetch(
        `http://209.94.57.1/tiles/${layer}/${v}/${h}.png`
    );
    const buffer = await result.buffer();
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("Cache-Control", "public, max-age=31536000");
    res.send(buffer);
});

app.post("/api/search", (req, res) => {
    const bbox = req.body.bbox;
    const onlyInBox = req.body.onlyInBox;

    const searchSet = {};
    const searchTerm = req.body.searchTerm;
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

    if (req.body.onlyInBox == true) {
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
    }

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
    pool.query(pointQuery)
        .then((pointResults) => {
            pool.query(polygonQuery)
                .then((polygonResults) => {
                    const results = [];
                    for (const result of pointResults.rows.concat(
                        polygonResults.rows
                    )) {
                        var added = false;
                        for (const word of result.name
                            .toLowerCase()
                            .split(" ")) {
                            if (word in searchSet) {
                                results.push(result);
                                added = true;
                                break;
                            }
                        }

                        if (added) continue;

                        for (const word of result.amenity
                            .toLowerCase()
                            .split(" ")) {
                            if (word in searchSet) {
                                results.push(result);
                                added = true;
                                break;
                            }
                        }

                        if (added) continue;

                        if (result.brand != null) {
                            for (const word of result.brand
                                .toLowerCase()
                                .split(" ")) {
                                if (word in searchSet) {
                                    results.push(result);
                                    break;
                                }
                            }
                        }
                    }
                    res.send(results);
                })
                .catch((error) => {
                    res.status(500).send(error);
                    console.log(error);
                });
        })
        .catch((error) => {
            res.status(500).send(error);
            console.log(error);
        });
});
