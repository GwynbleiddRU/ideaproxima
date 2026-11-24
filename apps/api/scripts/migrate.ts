// Applies pending SQL migrations from ./drizzle to DATABASE_URL. Safe to run repeatedly.
import "../src/load-env";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";

const database = await openDatabase(loadConfig().db.url);
await database.migrate();
await database.close();
console.info(`Migrations applied (${database.driver}).`);
