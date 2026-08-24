import 'dotenv/config';
import { loadEnv, env } from './env.js';
import { createApp } from './app.js';

loadEnv();

const app = createApp();

// For local dev
if (process.env.VERCEL !== '1') {
  const port = env().PORT;
  app.listen(port, () => {
    console.log(`Listening on :${port}`);
  });
}

export default app;
