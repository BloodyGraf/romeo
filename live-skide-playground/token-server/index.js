import http from "http";
import crypto from "crypto";

const API_KEY = "devkey";
const API_SECRET = "supersecretverylongsupersecretverylong"; // тот, что в keys.txt
// ---- JWT helpers ----

function base64url(input) {
    return Buffer.from(input)
        .toString("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");
}

function createJWT(payload, secret) {
    const header = {
        alg: "HS256",
        typ: "JWT",
    };

    const encodedHeader = base64url(JSON.stringify(header));
    const encodedPayload = base64url(JSON.stringify(payload));

    const data = `${encodedHeader}.${encodedPayload}`;
    const signature = crypto
        .createHmac("sha256", secret)
        .update(data)
        .digest("base64")
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

    return `${data}.${signature}`;
}

// ---- HTTP server ----

const server = http.createServer((req, res) => {
    // ---- CORS ----
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(200);
        res.end();
        return;
    }

    // ---- POST /token ----
    if (req.method === "POST" && req.url === "/token") {
        let body = "";

        req.on("data", chunk => {
            body += chunk;
        });

        req.on("end", () => {
            try {
                const { identity, room } = JSON.parse(body);
                const now = Math.floor(Date.now() / 1000);

                const payload = {
                    iss: API_KEY,
                    sub: identity,
                    nbf: now - 5,
                    exp: now + 600,
                    video: {
                        room,
                        roomJoin: true,
                        canPublish: true,
                        canSubscribe: true,
                    },
                };

                const jwt = createJWT(payload, API_SECRET);

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ token: jwt }));
            } catch (e) {
                res.writeHead(400);
                res.end("Invalid JSON");
            }
        });

        return;
    }

    res.writeHead(404);
    res.end("Not found");
});

server.listen(3001, () => {
    console.log("Token server running at http://localhost:3001");
});
