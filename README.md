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

- Node.js 18+
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
   - Add scope: `https://www.googleapis.com/auth/gmail.send`
   - Add your own Gmail address as a **Test user**
5. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Desktop app**
   - Download the JSON — you'll need `client_id` and `client_secret`

---

## Step 2 — Generate a Refresh Token

Run the included helper script **once**. It opens a browser auth flow and captures the token automatically:

```bash
# First, make sure your .env has GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET set, then:
npm install
node scripts/get-token.js
```

The script will print a URL — open it in your browser, grant access, and your refresh token will appear in the terminal.

> **Note**: The old `urn:ietf:wg:oauth:2.0:oob` redirect URI was removed by Google in 2022. The script uses `http://localhost:3333` instead, which works with Desktop app credentials automatically.

**Important**: This token never expires as long as you keep using it. Store it safely.

---

## Step 3 — Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` and fill in:

```env
GMAIL_CLIENT_ID=123456789.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxx
GMAIL_REFRESH_TOKEN=1//04xxxxxxxxxxxxxxxxxxxxxxxxxx
GMAIL_USER_EMAIL=you@gmail.com
```

---

## Step 4 — Build

```bash
npm install
npm run build
```

---

## Step 5 — Add to Claude Desktop

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
| `Missing Gmail OAuth2 credentials` | Check your `.env` file has all three values |
| `Token has been expired or revoked` | Re-run the refresh token script in Step 2 |
| `Insufficient Permission` | Make sure `gmail.send` scope was authorized |
| `Failed to fetch` | Verify your CLIENT_ID and CLIENT_SECRET are correct |

---

## Security Notes

- Your refresh token grants send-only access to your Gmail — keep it private
- Never commit `.env` to Git (it's in `.gitignore`)
- Revoke access anytime at [myaccount.google.com/permissions](https://myaccount.google.com/permissions)
