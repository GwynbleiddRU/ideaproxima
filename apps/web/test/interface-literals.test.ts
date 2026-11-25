/// <reference types="node" />

import { readdir } from "node:fs/promises";
import { join } from "node:path";
import { ESLint } from "eslint";
import { expect, test } from "vitest";

async function sourceDirectories(path: string): Promise<string[]> {
  const files = await readdir(path, { withFileTypes: true });
  const nested = await Promise.all(
    files.filter((file) => file.isDirectory()).map((file) => sourceDirectories(join(path, file.name))),
  );
  return [path, ...nested.flat()];
}

test("every web source directory rejects untranslated JSX and text props", async () => {
  const eslint = new ESLint();
  const fixture = [
    "export const probe = (ready: boolean, name: string) => <button",
    '  aria-label="Open menu"',
    '  title={ready ? "Ready" : "Please wait"}',
    "  aria-description={`Hello ${name}`}",
    '  data-state="ready">Plain text{"Rendered expression"}{ready && "Done"}</button>;',
  ].join("\n");
  const directories = await sourceDirectories("apps/web/src");
  const results = await Promise.all(
    directories.map((directory) => eslint.lintText(fixture, { filePath: join(directory, "probe.tsx") })),
  );
  for (const [result] of results) {
    expect(
      result?.messages.map(({ ruleId, line }) => [ruleId, line]),
      result?.filePath,
    ).toEqual([2, 3, 3, 4, 5, 5, 5].map((line) => ["no-restricted-syntax", line]));
  }
});

test("the web literal guard accepts catalogue calls, data and route identifiers", async () => {
  const eslint = new ESLint();
  const [result] = await eslint.lintText(
    'export const probe = (t: (id: string) => string) => <a href="/topics" aria-label={t("nav.topics")}>{t("nav.topics")}</a>;',
    { filePath: "apps/web/src/pages/topics/probe.tsx" },
  );
  expect(result?.messages).toEqual([]);
});
