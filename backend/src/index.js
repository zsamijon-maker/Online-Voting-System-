import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { logger } from './lib/logger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { cleanupExpiredChallenges } from './lib/challengeStore.js';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import electionRoutes from './routes/elections.js';
import candidateRoutes from './routes/candidates.js';
import candidateFlatRoutes from './routes/candidatesFlat.js';
import voteRoutes from './routes/votes.js';
import pageantRoutes from './routes/pageants.js';
import contestantRoutes from './routes/contestants.js';
import criteriaRoutes from './routes/criteria.js';
import judgeRoutes from './routes/judges.js';
import scoreRoutes from './routes/scores.js';
import auditRoutes from './routes/audit.js';

const app = express();
const PORT = process.env.PORT || 5000;

// ── CORS ─────────────────────────────────────────────────────────────────────
// ALLOWED_ORIGINS accepts a comma-separated list of fully-qualified origins.
// Example (production):  ALLOWED_ORIGINS=https://voting.myschool.edu
// Example (multi):       ALLOWED_ORIGINS=https://voting.myschool.edu,https://admin.myschool.edu
// Falls back to FRONTEND_URL for backward-compatibility.
const rawOrigins =
  process.env.ALLOWED_ORIGINS ||
  process.env.FRONTEND_URL ||
  'http://localhost:5173,https://online-voting-system-fejgnxjwk-zsamijon-makers-projects.vercel.app';
const allowedOrigins = rawOrigins
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // In production, every request must carry a recognised Origin header.
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        return callback(
          new Error('CORS: requests without an Origin header are not permitted in production')
        );
      }
      // Allow tools like Postman / curl in development.
      return callback(null, true);
    }
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS: origin '${origin}' is not in the allowed list`));
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Length'],
  credentials: true,
  maxAge: 86400, // cache pre-flight response for 24 h
};

app.use(cors(corsOptions));
// Explicitly handle pre-flight OPTIONS requests for every route.
app.options('*', cors(corsOptions));

// Security headers (X-Frame-Options, X-Content-Type-Options, HSTS, etc.)
app.use(helmet());

// Limit request body to 50 KB to prevent payload-based DoS attacks.
app.use(express.json({ limit: '50kb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

// Stricter rate limiting for auth endpoints to prevent brute-force attacks
// 5 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  skipSuccessfulRequests: false, // Count all requests, not just failures
});

// 3 registration attempts per 15 minutes per IP
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many registration attempts. Please try again in 15 minutes.' },
});

// Routes
// Apply auth-specific rate limiters before the auth routes
app.use('/api/auth/login', loginLimiter);
app.use('/api/auth/register', registerLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/elections', electionRoutes);
app.use('/api/elections/:electionId/candidates', candidateRoutes);
app.use('/api/candidates', candidateFlatRoutes);
app.use('/api/votes', voteRoutes);
app.use('/api/pageants', pageantRoutes);
app.use('/api/pageants/:pageantId/contestants', contestantRoutes);
app.use('/api/pageants/:pageantId/criteria', criteriaRoutes);
app.use('/api/pageants/:pageantId/judges', judgeRoutes);
app.use('/api/scores', scoreRoutes);
app.use('/api/audit', auditRoutes);

app.get('/', (req, res) => {
  res.send('Secure School Voting System Backend is running.');
});

// ── Global error handler — must be registered after all routes ────────────
app.use(errorHandler);

app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);

  // Cleanup expired challenge tokens every 5 minutes
  setInterval(async () => {
    try {
      await cleanupExpiredChallenges();
    } catch (error) {
      logger.error('Failed to cleanup expired challenges:', error);
    }
  }, 5 * 60 * 1000);
});

// Safety net: log unhandled promise rejections that somehow bypass asyncHandler.
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Promise Rejection:', reason);
});
