import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { strategyRouter } from './api/strategies.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.use('/api/strategies', strategyRouter);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const server = createServer(app);

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║              IVEE Canon Server v1.0                      ║
╠═══════════════════════════════════════════════════════════╣
║  Server:     http://localhost:${PORT}                       ║
║  API:        /api/strategies                              ║
║  Health:     /api/health                                 ║
║  Status:     Ready                                        ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

export { app, server };