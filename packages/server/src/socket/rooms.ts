import type { UserPresence, RoomState, User, ModelFile } from '@bentar/shared';
import { getProjectById } from '../routes/projects.js';

// In-memory room state
const rooms = new Map<string, Map<string, UserPresence>>();

export function getOrCreateRoom(projectId: string): Map<string, UserPresence> {
  let room = rooms.get(projectId);
  if (!room) {
    room = new Map();
    rooms.set(projectId, room);
  }
  return room;
}

export function addUserToRoom(projectId: string, user: User): UserPresence {
  const room = getOrCreateRoom(projectId);
  const presence: UserPresence = {
    user,
    lastSeen: new Date().toISOString(),
  };
  room.set(user.id, presence);
  return presence;
}

export function removeUserFromRoom(projectId: string, userId: string): void {
  const room = rooms.get(projectId);
  if (room) {
    room.delete(userId);
    if (room.size === 0) {
      rooms.delete(projectId);
    }
  }
}

export function getUsersInRoom(projectId: string): UserPresence[] {
  const room = rooms.get(projectId);
  if (!room) return [];
  return Array.from(room.values());
}

export function updateUserPresence(
  projectId: string,
  userId: string,
  update: Partial<UserPresence>,
): void {
  const room = rooms.get(projectId);
  if (!room) return;
  const presence = room.get(userId);
  if (presence) {
    Object.assign(presence, update, { lastSeen: new Date().toISOString() });
  }
}

export function getRoomState(projectId: string): RoomState {
  const project = getProjectById(projectId);
  const models: ModelFile[] = project?.models ?? [];
  return {
    projectId,
    users: getUsersInRoom(projectId),
    models,
  };
}

// Track which room each socket is in
const socketRooms = new Map<string, { projectId: string; userId: string }>();

export function setSocketRoom(socketId: string, projectId: string, userId: string): void {
  socketRooms.set(socketId, { projectId, userId });
}

export function getSocketRoom(socketId: string) {
  return socketRooms.get(socketId);
}

export function removeSocketRoom(socketId: string): { projectId: string; userId: string } | undefined {
  const info = socketRooms.get(socketId);
  socketRooms.delete(socketId);
  return info;
}
