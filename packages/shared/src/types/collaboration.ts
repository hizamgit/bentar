import type { User, ModelFile } from './project.js';

export interface Vector3 {
  x: number;
  y: number;
  z: number;
}

export interface CursorPosition {
  userId: string;
  position: Vector3;
  direction: Vector3;
}

export interface ElementSelection {
  userId: string;
  elementIds: string[];
  modelId: string;
}

export interface CameraState {
  position: Vector3;
  target: Vector3;
  up: Vector3;
}

export interface UserPresence {
  user: User;
  cursor?: CursorPosition;
  selection?: ElementSelection;
  camera?: CameraState;
  lastSeen: string;
}

export interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  message: string;
  timestamp: string;
}

export interface ModelChange {
  userId: string;
  modelId: string;
  elementId: string;
  changeType: 'property' | 'geometry' | 'add' | 'delete';
  data: Record<string, unknown>;
  timestamp: string;
}

export interface RoomState {
  projectId: string;
  users: UserPresence[];
  models: ModelFile[];
}

// Socket.IO typed event maps
export interface ClientToServerEvents {
  'room:join': (data: { projectId: string; user: User }) => void;
  'room:leave': (data: { projectId: string }) => void;
  'cursor:move': (data: CursorPosition) => void;
  'element:select': (data: ElementSelection) => void;
  'element:update': (data: ModelChange) => void;
  'camera:sync': (data: { userId: string; camera: CameraState }) => void;
  'chat:message': (data: { projectId: string; message: string }) => void;
  'model:upload-complete': (data: { projectId: string; model: ModelFile }) => void;
}

export interface ServerToClientEvents {
  'room:state': (data: RoomState) => void;
  'room:user-joined': (data: UserPresence) => void;
  'room:user-left': (data: { userId: string }) => void;
  'cursor:updated': (data: CursorPosition) => void;
  'element:selected': (data: ElementSelection) => void;
  'element:updated': (data: ModelChange) => void;
  'camera:synced': (data: { userId: string; camera: CameraState }) => void;
  'chat:new-message': (data: ChatMessage) => void;
  'model:added': (data: ModelFile) => void;
}
