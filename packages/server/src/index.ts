import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { SERVER_PORT, WEB_PORT } from '@bentar/shared';
import type { ClientToServerEvents, ServerToClientEvents } from '@bentar/shared';
import { registerSocketHandlers } from './socket/handlers.js';
import { projectsRouter } from './routes/projects.js';
import { uploadRouter } from './routes/upload.js';

const app = express();
const httpServer = createServer(app);

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: `http://localhost:${WEB_PORT}`,
    methods: ['GET', 'POST'],
  },
  maxHttpBufferSize: 100 * 1024 * 1024, // 100MB for model uploads
});

// Middleware
app.use(cors({ origin: `http://localhost:${WEB_PORT}` }));
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// REST routes
app.use('/api/projects', projectsRouter);
app.use('/api/upload', uploadRouter);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);
  registerSocketHandlers(io, socket);
});

httpServer.listen(SERVER_PORT, () => {
  console.log(`Bentar server running on http://localhost:${SERVER_PORT}`);
});
