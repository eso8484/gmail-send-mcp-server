# Gmail Send MCP Server

A TypeScript MCP server that adds **Gmail send capabilities** to AI clients like Claude Desktop.

The standard Gmail MCP connector can search, read, and draft emails — but cannot send them.
This server fills that gap with four tools:

| Tool | What it does |
|---|---|
| `gmail_send_email` | Send a brand-new email |
| `gmail_reply_to_thread` | Reply within an existing conversation thread |
| `gmail_send_draft` | Send a draft you already created |
| `gmail_forward_email` | Forward an existing email to new recipients |

---

## Prerequisites

- Node.js 18+ (20.6+ recommended — the Claude Code `--env-file` option needs it)
- A Google account with Gmail
- A Google Cloud project (free tier is fine)

---

## Step 1 — Enable the Gmail API and Create OAuth Credentials

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. Go to **APIs & Services → Library** → search for **Gmail API** → click **Enable**
4. Go to **APIs & Services → OAuth consent screen**
   - Choose **External** user type
   - Fill in App name (e.g. "Gmail MCP"), your email, and developer email
   - Add **both** scopes (reply & forward need to read the original message before sending):
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
   - Add your own Gmail address as a **Test user** (required while the app is in "Testing" mode, or Google blocks sign-in with "app not verified")
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app** — this matters: a Desktop client auto-allows the `localhost` redirect the token script uses. A **Web application** client will fail with `redirect_uri_mismatch` unless you manually add `http://localhost:4567` to its Authorized redirect URIs.
   - Download the JSON — you'll need `client_id` and `client_secret`

---

## Step 2 — Install Dependencies & Build

```bash
npm install
npm run build
```

### ⚠️ WSL2 + Windows filesystem (`/mnt/c`) — required for acceptable startup

If this project lives on a Windows path like `/mnt/c/...` and you run it under WSL2,
loading `node_modules` across the Windows↔Linux filesystem boundary is extremely slow
(tens of seconds to minutes). The MCP server will exceed Claude Code's 30-second startup
timeout and show **"connection timed out."**

Fix it by relocating `node_modules` to WSL's native Linux filesystem (drops startup from
~30s to ~1s). A helper script does this for you:

```bash
./setup-fast-node-modules.sh
npm run build
```

Re-run that script **any time you run `npm install`** — npm replaces the symlink it
creates with a real (slow) folder. Your source, `dist/`, and `.env` are untouched.

(If your project lives on the native Linux filesystem, e.g. `~/projects/...`, you can skip this.)

---

## Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your **client ID, secret, and email**. Leave the refresh token
blank for now — the next step fills it in for you:

```env
GMAIL_CLIENT_ID=123456789.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=
GMAIL_USER_EMAIL=you@gmail.com
```

---

## Step 4 — Generate a Refresh Token

Run the included helper script **once**. It reads your client ID/secret from `.env`,
walks you through Google sign-in, and writes the refresh token straight back into `.env`:

```bash
node get-refresh-token.js
```

1. It prints a URL — open it in your browser.
2. Sign in as your Gmail account and approve the permissions.
3. The token saves to `.env` automatically (only a masked version is printed to the terminal).

> This uses the modern `localhost` redirect flow. The old `urn:ietf:wg:oauth:2.0:oob`
> method that earlier versions of this guide used was shut down by Google in 2022 and no
> longer works. If you hit `redirect_uri_mismatch`, see the Troubleshooting table below.

**Note**: This token never expires as long as you keep using it. Keep `.env` private.

---

## Step 5 — Register the Server with Claude

### Claude Desktop

Open your Claude Desktop config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this block inside `"mcpServers"`:

```json
"gmail-send": {
  "command": "node",
  "args": ["/ABSOLUTE/PATH/TO/gmail-send-mcp-server/dist/index.js"],
  "env": {
    "GMAIL_CLIENT_ID": "your_client_id",
    "GMAIL_CLIENT_SECRET": "your_client_secret",
    "GMAIL_REFRESH_TOKEN": "your_refresh_token",
    "GMAIL_USER_EMAIL": "you@gmail.com"
  }
}
```

> Replace `/ABSOLUTE/PATH/TO/` with the actual full path on your machine.
> You can also omit the `env` block and use your `.env` file instead — `dotenv/config` is loaded automatically.

Restart Claude Desktop. You should see the new tools appear in the tool list.

### Claude Code (CLI)

From the project directory, register the server in one command:

```bash
claude mcp add gmail-send -- node --env-file="$(pwd)/.env" "$(pwd)/dist/index.js"
```

This loads your credentials from `.env`, keeping them out of the global config.
`--env-file` needs Node 20.6+. On older Node, pass the values inline instead:

```bash
claude mcp add gmail-send \
  -e GMAIL_CLIENT_ID="..." -e GMAIL_CLIENT_SECRET="..." \
  -e GMAIL_REFRESH_TOKEN="..." -e GMAIL_USER_EMAIL="you@gmail.com" \
  -- node "$(pwd)/dist/index.js"
```

Then confirm it connects (start a fresh session afterward to use the tools):

```bash
claude mcp list      # gmail-send should show: ✓ Connected
```

---

## Available Tools

### `gmail_send_email`
Send a new email to anyone.
```
to: "blessing@example.com"
subject: "Dinner plans"
body: "Hey, are you free Saturday?"
```

### `gmail_reply_to_thread`
Reply within an existing email thread (proper Gmail threading).
```
thread_id: "18f3ab..."
message_id: "18f3ab..."
to: "client@example.com"
subject: "Re: Project Update"
body: "Thanks for the update, I'll review by tomorrow."
```

### `gmail_send_draft`
Send a draft you already created (via the built-in Gmail MCP `create_draft` tool).
```
draft_id: "r-xxxxxxxxx"
```

### `gmail_forward_email`
Forward any email to someone else.
```
message_id: "18f3ab..."
to: "colleague@example.com"
note: "FYI — see below."
```

---

## Troubleshooting

| Error | Fix |
|---|---|
| MCP server "connection timed out" (WSL2 on `/mnt/c`) | Run `./setup-fast-node-modules.sh` then `npm run build` — see Step 2's WSL2 note |
| `Missing Gmail OAuth2 credentials` | Check your `.env` file has all three values |
| `Access blocked: redirect_uri_mismatch` | Your OAuth client must be a **Desktop app** type. If it's a **Web application**, add `http://localhost:4567` to its Authorized redirect URIs. |
| `Access blocked: app not verified` | Add your Gmail address as a **Test user** on the OAuth consent screen |
| `Token has been expired or revoked` | Re-run `node get-refresh-token.js` (Step 4) |
| `Insufficient Permission` | Make sure **both** `gmail.send` and `gmail.readonly` scopes were authorized |
| `Failed to fetch` | Verify your CLIENT_ID and CLIENT_SECRET are correct |

---

## Security Notes

- Your refresh token grants send + read access to your Gmail — keep it private
- Never commit `.env` to Git — it's already listed in this project's `.gitignore`
- Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
