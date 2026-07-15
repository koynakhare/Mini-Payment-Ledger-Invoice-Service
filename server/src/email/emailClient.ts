export interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailClient {
  send(options: SendEmailOptions): Promise<void>;
}

export class EmailClientError extends Error {
  readonly code: 'NOT_CONFIGURED' | 'SEND_FAILED';

  constructor(
    code: EmailClientError['code'],
    message: string,
    readonly cause?: unknown
  ) {
    super(message);
    this.name = 'EmailClientError';
    this.code = code;
  }
}

function getSmtpConfig(): {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
} | null {
  const host = process.env.SMTP_HOST?.trim() ?? '';
  const user = process.env.SMTP_USER?.trim() ?? '';
  const pass = process.env.SMTP_PASS?.trim() ?? '';
  const from = process.env.SMTP_FROM?.trim() || user;
  if (!host || !user || !pass || !from) {
    return null;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const secure =
    process.env.SMTP_SECURE === 'true' || port === 465;
  return { host, port: Number.isFinite(port) ? port : 587, user, pass, from, secure };
}

async function sendViaSmtp(options: SendEmailOptions): Promise<void> {
  const config = getSmtpConfig();
  if (!config) {
    throw new EmailClientError(
      'NOT_CONFIGURED',
      'SMTP is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, and optionally SMTP_FROM / SMTP_PORT.'
    );
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.pass,
    },
  });

  try {
    await transporter.sendMail({
      from: config.from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      attachments: options.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
        contentType: attachment.contentType,
      })),
    });
  } catch (error) {
    throw new EmailClientError(
      'SEND_FAILED',
      'Failed to send invoice email. Check SMTP settings and try again.',
      error instanceof Error ? error.message : error
    );
  }
}

async function sendViaConsole(options: SendEmailOptions): Promise<void> {
  const attachmentNames = (options.attachments ?? []).map((a) => a.filename).join(', ') || '(none)';
  console.info(
    `[email:console] to=${options.to} subject=${JSON.stringify(options.subject)} attachments=${attachmentNames}`
  );
}

function createDefaultClient(): EmailClient {
  return {
    async send(options) {
      if (getSmtpConfig()) {
        await sendViaSmtp(options);
        return;
      }
      // Local/dev without SMTP: log and succeed so sendInvoice still posts the ledger.
      await sendViaConsole(options);
    },
  };
}

const defaultClient = createDefaultClient();
let activeClient: EmailClient = defaultClient;

/** Returns the shared email client (overridable in tests). */
export function getEmailClient(): EmailClient {
  return activeClient;
}

/** Swap the email client for tests or alternate providers. */
export function setEmailClient(client: EmailClient): void {
  activeClient = client;
}

/** Restore the default SMTP/console client. */
export function resetEmailClient(): void {
  activeClient = defaultClient;
}

/** Convenience wrapper used by services. */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  return getEmailClient().send(options);
}
