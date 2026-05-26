// One-time helper to obtain a Gmail OAuth2 refresh token using the modern
// loopback redirect flow (the old urn:ietf:wg:oauth:2.0:oob flow is dead).
//
// Usage:
//   GMAIL_CLIENT_ID=xxx GMAIL_CLIENT_SECRET=yyy node get-refresh-token.js
//
// Then open the printed URL, authorize, and your refresh token prints here.

require("dotenv/config");
const http = require("http");
const fs = require("fs");
const path = require("path");
const { OAuth2Client } = require("google-auth-library");

// Writes the refresh token into .env, replacing the existing line if present.
function saveRefreshToken(token) {
  const envPath = path.join(__dirname, ".env");
  let content = "";
  try {
    content = fs.readFileSync(envPath, "utf8");
  } catch {
    // no .env yet — we'll create one
  }
  if (/^GMAIL_REFRESH_TOKEN=.*$/m.test(content)) {
    content = content.replace(/^GMAIL_REFRESH_TOKEN=.*$/m, `GMAIL_REFRESH_TOKEN=${token}`);
  } else {
    const sep = content === "" || content.endsWith("\n") ? "" : "\n";
    content += `${sep}GMAIL_REFRESH_TOKEN=${token}\n`;
  }
  fs.writeFileSync(envPath, content);
}

const CLIENT_ID = process.env.GMAIL_CLIENT_ID;
const CLIENT_SECRET = process.env.GMAIL_CLIENT_SECRET;
const PORT = parseInt(process.env.OAUTH_PORT ?? "4567", 10);
const REDIRECT_URI = `http://localhost:${PORT}`;

// gmail.send → send/reply/forward/send-draft
// gmail.readonly → needed because reply & forward read the original message first
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
];

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "\nMissing credentials. Run like this:\n\n" +
      "  GMAIL_CLIENT_ID=your_id GMAIL_CLIENT_SECRET=your_secret node get-refresh-token.js\n"
  );
  process.exit(1);
}

const oauth2Client = new OAuth2Client(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent", // forces a fresh refresh_token every run
  scope: SCOPES,
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.end(`Authorization failed: ${error}. Check the terminal.`);
    console.error(`\nAuthorization denied: ${error}\n`);
    server.close();
    process.exit(1);
  }
  if (!code) {
    res.end("Waiting for authorization code...");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.end("Success. You can close this tab and return to the terminal.");
    if (tokens.refresh_token) {
      saveRefreshToken(tokens.refresh_token);
      const masked =
        tokens.refresh_token.slice(0, 6) + "…" + tokens.refresh_token.slice(-4);
      console.log("\n=================================================");
      console.log("Success — refresh token saved to .env");
      console.log(`Token (masked): ${masked}`);
      console.log("=================================================\n");
    } else {
      console.log(
        "\nNo refresh_token returned. Revoke access at " +
          "https://myaccount.google.com/permissions and run again.\n"
      );
    }
  } catch (e) {
    res.end("Token exchange failed. Check the terminal.");
    console.error("\nToken exchange error:", e.message, "\n");
  } finally {
    server.close();
    process.exit(0);
  }
});

server.listen(PORT, () => {
  console.log("\n1. Open this URL in your browser:\n");
  console.log(authUrl);
  console.log("\n2. Sign in, approve the permissions.");
  console.log("3. Your refresh token will print here automatically.\n");
});
