import nodemailer from "nodemailer";
import type { AppConfig } from "../../config";
import type { renderAccountMail } from "./templates/account";

export type OutgoingMail = ReturnType<typeof renderAccountMail> & { to: string; id: string };
export interface MailSender {
  send(message: OutgoingMail): Promise<void>;
}

export function workerMail(config: AppConfig) {
  return {
    baseUrl: config.mail.baseUrl,
    key: config.rateLimits.keySecret,
    sender: createMailSender(config.mail),
  };
}

export function createMailSender(config: AppConfig["mail"]): MailSender {
  if (config.transport === "log")
    return {
      async send(message) {
        console.info("[development mail]", message.subject, message.text);
      },
    };
  const smtp = nodemailer.createTransport(config.smtpUrl!, { from: config.from });
  return {
    async send({ to, id, ...content }) {
      try {
        await smtp.sendMail({
          from: config.from,
          to,
          ...content,
          messageId: `<${id}@${config.from.split("@")[1]}>`,
          disableFileAccess: true,
          disableUrlAccess: true,
        });
      } catch {
        throw new Error("SMTP delivery failed");
      }
    },
  };
}
