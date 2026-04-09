import nodemailer from 'nodemailer';
import { logger } from './logger';
import { env } from '../env';

let transporter: nodemailer.Transporter | null | undefined;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter === undefined) {
    if (!env.SMTP_HOST || !env.MAIL_FROM) {
      transporter = null;
    } else {
      transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_PORT === 465,
        auth:
          env.SMTP_USER && env.SMTP_PASS
            ? { user: env.SMTP_USER, pass: env.SMTP_PASS }
            : undefined,
      });
    }
  }
  return transporter;
}

export function isMailConfigured(): boolean {
  return getTransporter() != null;
}

export async function sendMail(opts: { to: string; subject: string; text: string; html?: string }): Promise<void> {
  const t = getTransporter();
  if (!t) {
    logger.info({ to: opts.to, subject: opts.subject }, 'Email skipped (SMTP not configured); body logged below');
    logger.info(opts.text);
    return;
  }
  await t.sendMail({
    from: env.MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html ?? opts.text.replace(/\n/g, '<br/>'),
  });
}
