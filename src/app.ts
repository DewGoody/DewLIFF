import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import helmet from 'helmet';
import { requestId } from './middleware/requestId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { healthRouter } from './routes/health.js';
import { campaignRouter } from './routes/campaign.js';
import { quizRouter } from './routes/quiz.js';
import { pairRouter } from './routes/pair.js';
import { webhookRouter } from './routes/webhook.js';
import { adminRouter } from './routes/admin.js';
import { soloRouter } from './routes/solo.js';
import { messagesRouter } from './routes/messages.js';
import { cronRouter } from './routes/cron.js';
import { richMenusRouter } from './routes/richmenus.js';
import { uploadRouter } from './routes/upload.js';
import { rewardsAdminRouter, rewardsQuizRouter } from './routes/rewards.js';
import { groupRouter } from './routes/group.js';
import { reportsRouter } from './routes/reports.js';
import { joinRouter } from './routes/join.js';
import { auth } from './middleware/auth.js';
import { env } from './env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp() {
  const app = express();

  app.use(requestId);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors({ origin: env().ALLOWED_ORIGINS.split(',') }));

  // Webhook route needs raw body for signature verification — mount before json parser
  app.use('/api/webhook', webhookRouter);

  app.use(express.json());

  app.use(healthRouter);
  app.use('/api/campaign', campaignRouter);
  app.use('/api/quiz', quizRouter);
  app.use('/api/pair', pairRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/admin/messages', messagesRouter);
  app.use('/api/solo', soloRouter);
  app.use('/api/cron', cronRouter);
  app.use('/api/admin/richmenus', richMenusRouter);
  app.use('/api/admin/upload', uploadRouter);
  app.use('/api/admin/rewards', rewardsAdminRouter);
  app.use('/api/quiz/rewards', auth, rewardsQuizRouter);
  app.use('/api/group', groupRouter);
  app.use('/api/reports', reportsRouter);
  app.use('/join', joinRouter);

  // Serve LIFF frontend
  const publicDir = path.join(__dirname, '..', 'public');
  app.use(express.static(publicDir));

  // /quiz/:campaignId → serve index.html (LIFF reads campaignId from URL path)
  app.get('/quiz/:campaignId', (_req, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  app.use(errorHandler);

  return app;
}
