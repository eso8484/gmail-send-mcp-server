import { gmail } from "@googleapis/gmail";
import { OAuth2Client } from "google-auth-library";

/**
 * Creates and returns an authenticated OAuth2 client using environment credentials.
 * Expects GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN in process.env.
 */
export function createAuthClient(): OAuth2Client {
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error(
      "Missing Gmail OAuth2 credentials. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, and GMAIL_REFRESH_TOKEN in your .env file."
    );
  }

  const auth = new OAuth2Client(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return auth;
}

/**
 * Returns an authenticated Gmail API client.
 */
export function createGmailClient() {
  const auth = createAuthClient();
  return gmail({ version: "v1", auth });
}

/**
 * Builds a RFC 2822 compliant email message and returns it as a base64url-encoded string.
 * This format is required by the Gmail API.
 */
export function buildRawMessage(params: {
  to: string;
  cc?: string;
  bcc?: string;
  subject: string;
  body: string;
  isHtml?: boolean;
  from?: string;
  replyToMessageId?: string;
  threadId?: string;
  references?: string;
}): string {
  const from = params.from ?? process.env.GMAIL_USER_EMAIL ?? "";
  const contentType = params.isHtml
    ? "text/html; charset=UTF-8"
    : "text/plain; charset=UTF-8";

  const headers: string[] = [
    `From: ${from}`,
    `To: ${params.to}`,
    `Subject: ${params.subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: ${contentType}`,
  ];

  if (params.cc) headers.push(`Cc: ${params.cc}`);
  if (params.bcc) headers.push(`Bcc: ${params.bcc}`);
  if (params.replyToMessageId)
    headers.push(`In-Reply-To: ${params.replyToMessageId}`);
  if (params.references) headers.push(`References: ${params.references}`);

  const raw = [...headers, "", params.body].join("\r\n");

  // Gmail requires base64url encoding (replaces +→-, /→_, strips =)
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
