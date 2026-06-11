import { app } from "./app.js";
import { getPort } from "./config.js";

if (process.argv[1] === import.meta.filename) {
  const port = getPort();

  app.listen(port, () => {
    console.info(`DraftWise AI listening on http://localhost:${port}`);
  });
}
