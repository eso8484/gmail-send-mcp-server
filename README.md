# Gmail Send MCP Server

A TypeScript MCP server that adds **Gmail send capabilities** to AI clients like Claude Desktop and Claude Code.

The standard Gmail MCP connector can search, read, and draft emails — but it can't send them. This server fills that gap with four tools:

| Tool | What it does |
|---|---|
| `gmail_send_email` | Send a brand-new email |
| `gmail_reply_to_thread` | Reply within an existing conversation thread |
| `gmail_send_draft` | Send a draft you already created |
| `gmail_forward_email` | Forward an existing email to new recipients |

---

## Quick Start

**No clone. No `npm install`. No build.** This server runs straight from npm with `npx` — your AI client downloads and runs it on demand.

There are only three things to do:

1. **Create Google OAuth credentials** (one-time, ~15 min)
2. **Get a refresh token** (one command)
3. **Add the server to Claude** (one command)

Each is covered below.

---

## Prerequisites

- **Node.js 18+** installed (this is what provides the `npx` command)
- A **Google account** with Gmail

---

## Step 1 — Create Google OAuth Credentials (one-time)

This is the only manual part, and it's unavoidable: any tool that sends email *as you* needs **your own** credentials, authorized by you. You can't skip it or borrow someone else's.

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project (or use an existing one)
3. **APIs & Services → Library** → search **Gmail API** → **Enable**
4. **APIs & Services → OAuth consent screen**
   - User type: **External**
   - Fill in an app name, your email, and developer email
   - Add **both** scopes (reply & forward need to read the original message before sending):
     - `https://www.googleapis.com/auth/gmail.send`
     - `https://www.googleapis.com/auth/gmail.readonly`
   - Add your own Gmail address as a **Test user** (otherwise Google blocks sign-in with "app not verified")
5. **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app** — important: this auto-allows the `localhost` redirect the next step uses. A **Web application** client fails with `redirect_uri_mismatch` unless you manually add `http://localhost:4567` to its Authorized redirect URIs.
   - Copy the **Client ID** and **Client Secret**

---

## Step 2 — Get Your Refresh Token (one command, no clone)

Run the bundled helper straight from npm, passing the Client ID and Secret from Step 1:

```bash
GMAIL_CLIENT_ID=your_client_id GMAIL_CLIENT_SECRET=your_client_secret \
  npx -p gmail-send-mcp-server gmail-send-get-token
```

1. It prints a Google sign-in URL — open it in your browser.
2. Sign in and approve the permissions.
3. Your **refresh token** prints in the terminal. Copy it.

> This uses the modern `localhost` redirect flow — no codes to paste back.

You now have three secrets: **Client ID**, **Client Secret**, and **Refresh Token**.

---

## Step 3 — Add to Claude

### Claude Code (CLI)

One command — `npx` is the whole "install":

```bash
claude mcp add gmail-send \
  -e GMAIL_CLIENT_ID=your_client_id \
  -e GMAIL_CLIENT_SECRET=your_client_secret \
  -e GMAIL_REFRESH_TOKEN=your_refresh_token \
  -e GMAIL_USER_EMAIL=you@gmail.com \
  -- npx -y gmail-send-mcp-server
```

Check it connected:

```bash
claude mcp list      # gmail-send should show: ✓ Connected
```

Start a fresh session and the four tools are available.

### Claude Desktop

Open your config file:

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

Add this block inside `"mcpServers"` (note `command` is just `npx`):

```json
"gmail-send": {
  "command": "npx",
  "args": ["-y", "gmail-send-mcp-server"],
  "env": {
    "GMAIL_CLIENT_ID": "your_client_id",
    "GMAIL_CLIENT_SECRET": "your_client_secret",
    "GMAIL_REFRESH_TOKEN": "your_refresh_token",
    "GMAIL_USER_EMAIL": "you@gmail.com"
  }
}
```

Restart Claude Desktop — the new tools appear in the tool list.

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
| `Access blocked: redirect_uri_mismatch` | Your OAuth client must be a **Desktop app** type. If it's a **Web application**, add `http://localhost:4567` to its Authorized redirect URIs. |
| `Access blocked: app not verified` | Add your Gmail address as a **Test user** on the OAuth consent screen |
| `Missing Gmail OAuth2 credentials` | Make sure all four values are set (the `-e` flags, or the `env` block) |
| `Insufficient Permission` | Make sure **both** `gmail.send` and `gmail.readonly` scopes were authorized |
| `Token has been expired or revoked` | Re-run the Step 2 command to get a fresh refresh token |
| `Failed to fetch` | Double-check your Client ID and Client Secret |

---

## Security Notes

- Your refresh token grants send + read access to your Gmail — keep it private.
- The token lives only in your Claude config / environment variables — it isn't committed anywhere.
- Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions).

---

## Local Development (optional — only if you want to modify the code)

```bash
git clone https://github.com/eso8484/gmail-send-mcp-server.git
cd gmail-send-mcp-server
npm install
npm run build
```

Then point your client at `node /absolute/path/dist/index.js` instead of `npx`. On WSL2 with the project on a Windows path (`/mnt/c/...`), run `./setup-fast-node-modules.sh` first — loading `node_modules` across the Windows filesystem is otherwise too slow and the server times out.
