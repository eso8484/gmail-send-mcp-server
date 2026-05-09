#!/usr/bin/env node
/**
 * One-time script to generate a Gmail OAuth2 refresh token.
 * Usage: node scripts/get-token.js
 *
 * The OOB (urn:ietf:wg:oauth:2.0:oob) redirect was removed by Google in 2022.
 * This script uses a localhost redirect instead, which works with Desktop app credentials.
 */

const { google } = require("googleapis");
const http = require("http");
const url = require("url");

const PORT = 3333;
const REDIRECT_URI = `http://localhost:${PORT}`;

require("dotenv").config();

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "\nError: GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET must be set.\n" +
      "Either export them as environment variables or add them to your .env file.\n"
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  scope: ["https://www.googleapis.com/auth/gmail.send"],
  prompt: "consent",
});

console.log("\n─────────────────────────────────────────────────────");
console.log("Gmail OAuth2 Refresh Token Generator");
console.log("─────────────────────────────────────────────────────");
console.log("\n1. Open this URL in your browser:\n");
console.log("   " + authUrl);
console.log("\n2. Sign in, grant access, then wait — the token will appear here automatically.\n");

const server = http.createServer(async (req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname !== "/") { res.writeHead(404); res.end(); return; }
  const code = parsed.query.code;
  const error = parsed.query.error;
  if (error) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(`<h2>Authorization failed: ${error}</h2><p>You can close this tab.</p>`);
    console.error(`\nAuthorization failed: ${error}\n`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end("<h2>No code received.</h2><p>You can close this tab.</p>");
    server.close();
    return;
  }
  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>✅ Authorization successful!</h2><p>You can close this tab and check your terminal.</p>");
    console.log("─────────────────────────────────────────────────────");
    console.log("✅ Success! Add this to your .env file:\n");
    console.log(`GMAIL_REFRESH_TOKEN=${tokens.refresh_token}`);
    console.log("\n─────────────────────────────────────────────────────\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Error exchanging code: ${err.message}</h2><p>You can close this tab.</p>`);
    console.error("\nFailed to exchange authorization code:", err.message, "\n");
  }
  server.close();
});

server.listen(PORT, () => {});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    console.error(`\nPort ${PORT} is already in use. Kill whatever is running on it and retry.\n`);
  } else {
    console.error("\nServer error:", err.message, "\n");
  }
  process.exit(1);
});
