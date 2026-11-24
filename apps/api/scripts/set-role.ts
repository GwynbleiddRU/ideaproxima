/**
 * Operator command: set a person's platform role. This is how the first admin of a fresh deployment is appointed
 * (there is nobody yet who could do it through the API). The change is recorded in the public activity ledger
 * as a system action.
 *
 *   npm run admin:set-role -- <handle> <member|moderator|admin>      (development, from the repo)
 *   node apps/api/dist/set-role.js <handle> <member|moderator|admin> (production build / container)
 */
import "../src/load-env";
import { PERSON_ROLES, type PersonRole } from "@ideaproxima/domain";
import { loadConfig } from "../src/config";
import { openDatabase } from "../src/db/client";
import { assignRoleAsOperator } from "../src/modules/identity/service";

const [handle, role] = process.argv.slice(2);
if (!handle || !role || !(PERSON_ROLES as readonly string[]).includes(role)) {
  console.error(`Usage: set-role <handle> <${PERSON_ROLES.join("|")}>`);
  process.exit(2);
}

const database = await openDatabase(loadConfig().db.url);
try {
  await database.migrate();
  const person = await assignRoleAsOperator(database.db, handle, role as PersonRole);
  console.info(`${person.handle} is now ${person.role}.`);
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await database.close();
}
