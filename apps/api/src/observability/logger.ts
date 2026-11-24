import { createRequire } from "node:module";
import pino, { type DestinationStream, type Logger } from "pino";
import type { AppConfig } from "../config";

const require = createRequire(import.meta.url);

function prettyDestination(): DestinationStream | undefined {
  // Production-only installs omit the development formatter.
  try {
    require.resolve("pino-pretty");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "MODULE_NOT_FOUND") return undefined;
    throw error;
  }
  const pretty = require("pino-pretty") as () => DestinationStream;
  return pretty();
}

export function createLogger(config: AppConfig["log"], destination?: DestinationStream): Logger {
  const output = destination ?? (config.format === "pretty" ? prettyDestination() : undefined);
  return pino({ level: config.level, base: undefined }, output);
}
