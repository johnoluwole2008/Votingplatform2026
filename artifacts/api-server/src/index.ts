import app, { ensureSessionTable } from "./app";
import { logger } from "./lib/logger";
import { processScheduledEmailJobs } from "./routes/admin/email";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

ensureSessionTable()
  .then(() => {
    setInterval(() => { processScheduledEmailJobs().catch(() => {}); }, 60_000);

    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }
      logger.info({ port }, "Server listening");
    });
  })
  .catch((err) => {
    logger.error({ err }, "Failed to ensure session table — aborting startup");
    process.exit(1);
  });
