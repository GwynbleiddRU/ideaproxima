// Applies pending SQL migrations from ./drizzle to DATABASE_URL. Safe to run repeatedly.
import "../src/load-env";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";

const { databaseUrl } = loadConfig();
const database = await openDatabase(databaseUrl);
await database.migrate();
await database.close();
console.info(`Migrations applied (${database.driver}).`);
