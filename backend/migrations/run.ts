// Usage (from backend/): bun migrations/run.ts <file.sql> [dev|prod]
import { Client } from "pg";
import fs from "fs";

const [file, target = "dev"] = process.argv.slice(2);
if (!file || !["dev", "prod"].includes(target)) {
    console.error("Usage: bun migrations/run.ts <file.sql> [dev|prod]");
    process.exit(1);
}

const connection = JSON.parse((target === "prod" ? process.env.PROD_DB_CONNECTION : process.env.DEV_DB_CONNECTION)!);
const client = new Client(connection);

client.connect()
    .then(() => {
        console.log(`Running ${file} on ${target} (${connection.database})`);
        return client.query(fs.readFileSync(file, "utf8"));
    })
    .then(() => console.log("Migration complete"))
    .catch((err) => {
        console.error("Migration failed, nothing was changed:", err.message);
        process.exitCode = 1;
    })
    .finally(() => client.end());
