import 'dotenv/config';
import { loadEnv } from '../src/env.js';
import { createApp } from '../src/app.js';

loadEnv();
const app = createApp();

export default app;
