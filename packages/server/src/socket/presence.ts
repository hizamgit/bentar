import type { CursorPosition, ElementSelection, CameraState } from '@bentar/shared';
import { updateUserPresence } from './rooms.js';

export function handleCursorMove(projectId: string, data: CursorPosition): void {
  updateUserPresence(projectId, data.userId, { cursor: data });
}

export function handleElementSelect(projectId: string, data: ElementSelection): void {
  updateUserPresence(projectId, data.userId, { selection: data });
}

export function handleCameraSync(projectId: string, userId: string, camera: CameraState): void {
  updateUserPresence(projectId, userId, { camera });
}
