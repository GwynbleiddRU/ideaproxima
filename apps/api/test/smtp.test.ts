import { once } from "node:events";
import { createServer, type AddressInfo } from "node:net";
import { createInterface } from "node:readline";
import { expect, it } from "vitest";
import { createMailSender } from "../src/modules/mail/sender";

it("delivers a multipart message over SMTP with a retry-stable Message-ID", async () => {
  const messages: string[] = [];
  const server = createServer((socket) => {
    socket.write("220 localhost test mailbox\r\n");
    const lines = createInterface({ input: socket });
    let data: string[] | undefined;
    lines.on("line", (line) => {
      if (data && line !== ".") {
        data.push(line);
        return;
      }
      if (data) {
        messages.push(data.join("\n"));
        data = undefined;
      } else if (line === "DATA") {
        data = [];
        socket.write("354 End with a dot\r\n");
        return;
      } else if (line === "QUIT") {
        socket.end("221 Bye\r\n");
        return;
      }
      socket.write("250 OK\r\n");
    });
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const smtp = createMailSender({
      transport: "smtp",
      smtpUrl: "smtp://127.0.0.1:" + (server.address() as AddressInfo).port,
      from: "accounts@example.test",
      baseUrl: "https://archive.example",
    });
    const message = {
      id: "same-job",
      to: "reader@example.test",
      subject: "Confirmation",
      text: "Plain message",
      html: "<p>HTML message</p>",
    };
    await smtp.send(message);
    await smtp.send(message);
    expect(messages).toHaveLength(2);
    for (const body of messages) {
      expect(body).toContain("Message-ID: <same-job@example.test>");
      expect(body).toContain("multipart/alternative");
      expect(body).toContain(message.text);
      expect(body).toContain(message.html);
    }
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});
