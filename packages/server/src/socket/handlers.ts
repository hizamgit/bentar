import type { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@bentar/shared';
import { v4 as uuidv4 } from 'uuid';
import {
  addUserToRoom,
  removeUserFromRoom,
  getRoomState,
  setSocketRoom,
  removeSocketRoom,
} from './rooms.js';
import { handleCursorMove, handleElementSelect, handleCameraSync } from './presence.js';

type IOServer = Server<ClientToServerEvents, ServerToClientEvents>;
type IOSocket = Socket<ClientToServerEvents, ServerToClientEvents>;

export function registerSocketHandlers(io: IOServer, socket: IOSocket): void {
  // Join a project room
  socket.on('room:join', ({ projectId, user }) => {
    socket.join(projectId);
    const presence = addUserToRoom(projectId, user);
    setSocketRoom(socket.id, projectId, user.id);

    // Send current room state to the joining user
    socket.emit('room:state', getRoomState(projectId));

    // Notify others in the room
    socket.to(projectId).emit('room:user-joined', presence);
    console.log(`User ${user.name} (${user.source}) joined project ${projectId}`);
  });

  // Leave a project room
  socket.on('room:leave', ({ projectId }) => {
    const info = removeSocketRoom(socket.id);
    if (info) {
      socket.leave(projectId);
      removeUserFromRoom(projectId, info.userId);
      socket.to(projectId).emit('room:user-left', { userId: info.userId });
      console.log(`User ${info.userId} left project ${projectId}`);
    }
  });

  // Cursor movement
  socket.on('cursor:move', (data) => {
    const info = removeSocketRoom(socket.id);
    if (!info) return;
    setSocketRoom(socket.id, info.projectId, info.userId);
    handleCursorMove(info.projectId, data);
    socket.to(info.projectId).emit('cursor:updated', data);
  });

  // Element selection
  socket.on('element:select', (data) => {
    const info = removeSocketRoom(socket.id);
    if (!info) return;
    setSocketRoom(socket.id, info.projectId, info.userId);
    handleElementSelect(info.projectId, data);
    socket.to(info.projectId).emit('element:selected', data);
  });

  // Element property update
  socket.on('element:update', (data) => {
    const info = removeSocketRoom(socket.id);
    if (!info) return;
    setSocketRoom(socket.id, info.projectId, info.userId);
    socket.to(info.projectId).emit('element:updated', data);
  });

  // Camera sync
  socket.on('camera:sync', (data) => {
    const info = removeSocketRoom(socket.id);
    if (!info) return;
    setSocketRoom(socket.id, info.projectId, info.userId);
    handleCameraSync(info.projectId, data.userId, data.camera);
    socket.to(info.projectId).emit('camera:synced', data);
  });

  // Chat message
  socket.on('chat:message', ({ projectId, message }) => {
    const info = removeSocketRoom(socket.id);
    if (!info) return;
    setSocketRoom(socket.id, info.projectId, info.userId);

    const chatMessage = {
      id: uuidv4(),
      userId: info.userId,
      userName: info.userId, // Will be resolved from presence
      message,
      timestamp: new Date().toISOString(),
    };
    io.to(projectId).emit('chat:new-message', chatMessage);
  });

  // Model upload notification
  socket.on('model:upload-complete', ({ projectId, model }) => {
    socket.to(projectId).emit('model:added', model);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const info = removeSocketRoom(socket.id);
    if (info) {
      removeUserFromRoom(info.projectId, info.userId);
      socket.to(info.projectId).emit('room:user-left', { userId: info.userId });
      console.log(`User ${info.userId} disconnected`);
    }
  });
}
