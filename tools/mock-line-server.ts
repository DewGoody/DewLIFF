/**
 * Mock LINE API server for local development.
 * Responds to verify token + push message without real LINE credentials.
 */
import express from 'express';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Mock users
const USERS: Record<string, { sub: string; name: string }> = {
  'token-alice': { sub: 'U_alice_001', name: 'อลิซ' },
  'token-bob': { sub: 'U_bob_002', name: 'บ็อบ' },
};

// POST /oauth2/v2.1/verify — mock ID token verification
app.post('/oauth2/v2.1/verify', (req, res) => {
  const idToken = req.body.id_token;
  const user = USERS[idToken];
  if (!user) {
    console.log(`  [LINE mock] ✕ verify failed: unknown token "${idToken}"`);
    res.status(400).json({ error: 'invalid_request', error_description: 'Invalid ID token' });
    return;
  }
  console.log(`  [LINE mock] ✓ verify → ${user.name} (${user.sub})`);
  res.json({ sub: user.sub, name: user.name, picture: '' });
});

// POST /v2/bot/message/push — mock push message
app.post('/v2/bot/message/push', (req, res) => {
  const to = req.body.to;
  const msgs = req.body.messages || [];
  console.log(`  [LINE mock] 📩 push to ${to}:`);
  for (const m of msgs) {
    if (m.type === 'flex') {
      console.log(`    flex: "${m.altText}"`);
    } else {
      console.log(`    ${m.type}: ${JSON.stringify(m).slice(0, 100)}`);
    }
  }
  res.json({});
});

// GET /v2/bot/profile/:userId — mock profile
app.get('/v2/bot/profile/:userId', (req, res) => {
  const entry = Object.values(USERS).find(u => u.sub === req.params.userId);
  if (entry) {
    res.json({ displayName: entry.name, pictureUrl: '' });
  } else {
    res.status(404).json({ message: 'Not found' });
  }
});

const PORT = 9999;
app.listen(PORT, () => {
  console.log(`\n🤖 Mock LINE API running on http://localhost:${PORT}\n`);
});
