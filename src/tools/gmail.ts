import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createGmailClient, buildRawMessage } from "../auth.js";

export function registerGmailTools(server: McpServer): void {
  server.registerTool(
    "gmail_send_email",
    {
      title: "Send Email",
      description: `Send a new email via Gmail.

Use this tool whenever the user wants to send, compose and send, or deliver an email to someone.
This tool actually delivers the email — it is NOT the same as creating a draft.

Args:
  - to (string): Recipient email address or addresses (comma-separated for multiple)
  - subject (string): Email subject line
  - body (string): Email body content
  - cc (string, optional): CC recipients, comma-separated
  - bcc (string, optional): BCC recipients, comma-separated
  - is_html (boolean, optional): Set true if body contains HTML markup (default: false)

Returns:
  - message_id: Gmail message ID of the sent email
  - thread_id: Thread ID the email belongs to
  - confirmation: Human-readable success message`,
      inputSchema: z.object({
        to: z.string().min(1).describe("Recipient email address(es), comma-separated"),
        subject: z.string().min(1).describe("Email subject line"),
        body: z.string().min(1).describe("Email body text (or HTML if is_html=true)"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
        bcc: z.string().optional().describe("BCC recipients, comma-separated"),
        is_html: z.boolean().optional().default(false).describe("Set true if body is HTML (default: false)"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ to, subject, body, cc, bcc, is_html }) => {
      try {
        const gmail = createGmailClient();
        const raw = buildRawMessage({ to, subject, body, cc, bcc, isHtml: is_html });
        const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        const result = {
          message_id: res.data.id ?? "unknown",
          thread_id: res.data.threadId ?? "unknown",
          confirmation: `✅ Email sent to ${to} with subject "${subject}"`,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error sending email: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "gmail_reply_to_thread",
    {
      title: "Reply to Email Thread",
      description: `Reply to an existing Gmail thread (conversation).

Args:
  - thread_id (string): The Gmail thread ID to reply within
  - message_id (string): The specific message ID you're replying to
  - to (string): Recipient(s) — usually the original sender's email
  - subject (string): Subject line — should start with "Re: "
  - body (string): Your reply text
  - cc (string, optional): CC recipients
  - is_html (boolean, optional): Set true if body is HTML`,
      inputSchema: z.object({
        thread_id: z.string().min(1).describe("Gmail thread ID to reply within"),
        message_id: z.string().min(1).describe("Message ID of the email being replied to"),
        to: z.string().min(1).describe("Recipient email address(es)"),
        subject: z.string().min(1).describe('Subject — typically "Re: <original subject>"'),
        body: z.string().min(1).describe("Reply body text"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
        is_html: z.boolean().optional().default(false).describe("Set true if body is HTML"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ thread_id, message_id, to, subject, body, cc, is_html }) => {
      try {
        const gmail = createGmailClient();
        let references = message_id;
        try {
          const original = await gmail.users.messages.get({
            userId: "me", id: message_id, format: "metadata", metadataHeaders: ["References", "Message-ID"],
          });
          const headers = original.data.payload?.headers ?? [];
          const refHeader = headers.find((h) => h.name === "References");
          if (refHeader?.value) references = `${refHeader.value} ${message_id}`;
        } catch { /* proceed with just message_id */ }
        const raw = buildRawMessage({ to, subject, body, cc, isHtml: is_html, replyToMessageId: message_id, references });
        const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw, threadId: thread_id } });
        const result = {
          message_id: res.data.id ?? "unknown",
          thread_id: res.data.threadId ?? thread_id,
          confirmation: `✅ Reply sent to ${to} in thread ${thread_id}`,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error replying to thread: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "gmail_send_draft",
    {
      title: "Send Existing Draft",
      description: `Send a Gmail draft that was previously created.

Args:
  - draft_id (string): The Gmail draft ID to send

Note: Once sent, the draft is automatically deleted from Gmail's drafts folder.`,
      inputSchema: z.object({
        draft_id: z.string().min(1).describe("The Gmail draft ID to send"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: true },
    },
    async ({ draft_id }) => {
      try {
        const gmail = createGmailClient();
        const res = await gmail.users.drafts.send({ userId: "me", requestBody: { id: draft_id } });
        const result = {
          message_id: res.data.id ?? "unknown",
          thread_id: res.data.threadId ?? "unknown",
          confirmation: `✅ Draft ${draft_id} has been sent successfully`,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error sending draft: ${message}` }], isError: true };
      }
    }
  );

  server.registerTool(
    "gmail_forward_email",
    {
      title: "Forward Email",
      description: `Forward an existing Gmail message to one or more recipients.

Args:
  - message_id (string): The Gmail message ID to forward
  - to (string): Forward-to email address(es), comma-separated
  - note (string, optional): An optional note to prepend before the forwarded content
  - cc (string, optional): CC recipients`,
      inputSchema: z.object({
        message_id: z.string().min(1).describe("The Gmail message ID to forward"),
        to: z.string().min(1).describe("Forward recipient email address(es)"),
        note: z.string().optional().describe("Optional note to add above the forwarded content"),
        cc: z.string().optional().describe("CC recipients, comma-separated"),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    },
    async ({ message_id, to, note, cc }) => {
      try {
        const gmail = createGmailClient();
        const original = await gmail.users.messages.get({ userId: "me", id: message_id, format: "full" });
        const headers = original.data.payload?.headers ?? [];
        const getHeader = (name: string) =>
          headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? "";
        const originalSubject = getHeader("Subject");
        const originalFrom = getHeader("From");
        const originalDate = getHeader("Date");
        const originalTo = getHeader("To");
        let originalBody = "";
        const parts = original.data.payload?.parts ?? [];
        const textPart = parts.find((p) => p.mimeType === "text/plain");
        if (textPart?.body?.data) {
          originalBody = Buffer.from(textPart.body.data, "base64").toString("utf-8");
        } else if (original.data.payload?.body?.data) {
          originalBody = Buffer.from(original.data.payload.body.data, "base64").toString("utf-8");
        }
        const fwdHeader = [
          `---------- Forwarded message ----------`,
          `From: ${originalFrom}`,
          `Date: ${originalDate}`,
          `Subject: ${originalSubject}`,
          `To: ${originalTo}`,
          ``,
        ].join("\n");
        const body = note ? `${note}\n\n${fwdHeader}${originalBody}` : `${fwdHeader}${originalBody}`;
        const subject = originalSubject.startsWith("Fwd:") ? originalSubject : `Fwd: ${originalSubject}`;
        const raw = buildRawMessage({ to, subject, body, cc });
        const res = await gmail.users.messages.send({ userId: "me", requestBody: { raw } });
        const result = {
          message_id: res.data.id ?? "unknown",
          thread_id: res.data.threadId ?? "unknown",
          confirmation: `✅ Email forwarded to ${to} (original subject: "${originalSubject}")`,
        };
        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }], structuredContent: result };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error forwarding email: ${message}` }], isError: true };
      }
    }
  );
}
