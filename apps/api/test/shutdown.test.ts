import { fork } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import { expect, it } from "vitest";

async function startFixture(delay: number, deadline: number) {
  const child = fork(
    fileURLToPath(new URL("./fixtures/draining-server.ts", import.meta.url)),
    [String(delay), String(deadline)],
    { execArgv: ["--import", "tsx"], silent: true },
  );
  let logs = "";
  child.stdout?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    logs += chunk.toString();
  });
  const closed = once(child, "close");
  const [{ port }] = await Promise.race([
    once(child, "message") as Promise<[{ type: "listening"; port: number }]>,
    closed.then(() => {
      throw new Error(`Fixture exited before listening: ${logs}`);
    }),
  ]);
  const origin = `http://127.0.0.1:${port}`;
  return {
    child,
    logs: () => logs,
    closed,
    fetch: (path: string, signal?: AbortSignal) =>
      fetch(origin + path, { headers: { Connection: "close" }, signal }),
    terminate() {
      // Windows child.kill("SIGTERM") terminates the process without running Node's handler.
      if (process.platform === "win32") child.send("terminate");
      else child.kill("SIGTERM");
    },
    async dispose() {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
      await closed;
    },
  };
}

it("reports draining before listener close and lets the in-flight request use the database", async () => {
  const server = await startFixture(1_200, 4_000);
  try {
    expect((await server.fetch("/readyz")).status).toBe(200);
    const running = once(server.child, "message");
    const request = server.fetch("/slow-fixture").then(
      (response) => response.text(),
      () => "disconnected",
    );
    expect((await running)[0]).toEqual({ type: "inFlight" });
    server.terminate();
    await expect.poll(async () => (await server.fetch("/readyz")).status).toBe(503);
    expect(await (await server.fetch("/readyz")).json()).toEqual({ ok: false, check: "draining" });
    expect((await server.fetch("/livez")).status).toBe(200);
    await expect
      .poll(
        () =>
          server.fetch("/livez").then(
            () => true,
            () => false,
          ),
        { timeout: 3_000 },
      )
      .toBe(false);
    server.child.send("release");
    expect(await request).toBe("finished with database");
    expect(await server.closed).toEqual([0, null]);
    expect(server.logs()).toContain('"force":false,"msg":"fixture database closed"');
  } finally {
    await server.dispose();
  }
});

it("closes a stuck connection at the request deadline", async () => {
  const server = await startFixture(0, 100);
  try {
    const running = once(server.child, "message");
    const request = server.fetch("/slow-fixture").then(
      () => "response",
      () => "disconnected",
    );
    expect((await running)[0]).toEqual({ type: "inFlight" });
    server.terminate();
    expect(await request).toBe("disconnected");
    expect(await server.closed).toEqual([0, null]);
    expect(server.logs()).toContain("shutdown request deadline exceeded");
    expect(server.logs()).toContain('"force":true,"msg":"fixture database closed"');
  } finally {
    await server.dispose();
  }
});

it("keeps the database open while a disconnected request handler finishes", async () => {
  const server = await startFixture(0, 4_000);
  try {
    const controller = new AbortController();
    const running = once(server.child, "message");
    const request = server.fetch("/slow-fixture", controller.signal).catch((error: unknown) => error);
    expect((await running)[0]).toEqual({ type: "inFlight" });
    controller.abort();
    expect(await request).toMatchObject({ name: "AbortError" });
    server.terminate();
    await expect
      .poll(
        () =>
          server.fetch("/livez").then(
            () => true,
            () => false,
          ),
        { timeout: 3_000 },
      )
      .toBe(false);
    server.child.send("release");
    expect(await server.closed).toEqual([0, null]);
    const logs = server.logs();
    expect(logs).toMatch(/fixture request finished[\s\S]*"force":false,"msg":"fixture database closed"/);
  } finally {
    await server.dispose();
  }
});

it.each(["uncaughtException", "unhandledRejection"])("reports %s and exits 1", async (source) => {
  const server = await startFixture(0, 100);
  try {
    server.child.send(source);
    expect(await server.closed).toEqual([1, null]);
    expect(server.logs()).toContain('"level":60');
    expect(server.logs()).toContain(`"source":"${source}"`);
    expect(server.logs()).not.toContain("private fatal fixture body");
  } finally {
    await server.dispose();
  }
});
