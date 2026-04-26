// Side-effect-only module that loads .env.local before anything else.
// Import this FIRST in any standalone script so process.env is populated
// before transitive imports (e.g. db/client.ts) read it.
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();
