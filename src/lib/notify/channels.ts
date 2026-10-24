// Delivery channels. Each one throws with a readable message when it can't deliver, so the
// dispatcher can store it and retry.
import nodemailer from "nodemailer";
import type { AlertMessage } from "@/lib/notify/message";

// ---------- Email (SMTP_URL, MAIL_FROM) ----------

let transport: nodemailer.Transporter | null = null;

export function emailConfigured() {
  return Boolean(process.env.SMTP_URL && process.env.MAIL_FROM);
}

export async function sendEmail(to: string, message: AlertMessage) {
  if (!emailConfigured()) throw new Error("Email not configured (SMTP_URL, MAIL_FROM)");
  transport ??= nodemailer.createTransport(process.env.SMTP_URL);
  await transport.sendMail({
    from: process.env.MAIL_FROM,
    to,
    subject: message.subject,
    text: message.text,
  });
}

// ---------- WhatsApp Cloud API (Meta) ----------
// Messages a business starts must use a template approved by Meta. The template's body
// takes four parameters, see AlertMessage.whatsappParams.

const DEFAULT_GRAPH_URL = "https://graph.facebook.com/v23.0";
const REQUEST_TIMEOUT_MS = 10_000;

export function whatsappConfigured() {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE
  );
}

export async function sendWhatsApp(to: string, message: AlertMessage) {
  if (!whatsappConfigured()) {
    throw new Error("WhatsApp not configured (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TEMPLATE)");
  }
  const base = (process.env.WHATSAPP_GRAPH_URL || DEFAULT_GRAPH_URL).replace(/\/$/, "");
  const response = await fetch(`${base}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: process.env.WHATSAPP_TEMPLATE,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANG || "es" },
        components: [
          {
            type: "body",
            parameters: message.whatsappParams.map((text) => ({ type: "text", text })),
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(`WhatsApp API ${response.status}: ${body?.error?.message ?? response.statusText}`);
  }
}
