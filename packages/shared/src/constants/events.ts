// Socket.IO event name constants
export const EVENTS = {
  // Room events
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  ROOM_STATE: 'room:state',
  ROOM_USER_JOINED: 'room:user-joined',
  ROOM_USER_LEFT: 'room:user-left',

  // Cursor events
  CURSOR_MOVE: 'cursor:move',
  CURSOR_UPDATED: 'cursor:updated',

  // Element events
  ELEMENT_SELECT: 'element:select',
  ELEMENT_SELECTED: 'element:selected',
  ELEMENT_UPDATE: 'element:update',
  ELEMENT_UPDATED: 'element:updated',

  // Camera events
  CAMERA_SYNC: 'camera:sync',
  CAMERA_SYNCED: 'camera:synced',

  // Chat events
  CHAT_MESSAGE: 'chat:message',
  CHAT_NEW_MESSAGE: 'chat:new-message',

  // Model events
  MODEL_UPLOAD_COMPLETE: 'model:upload-complete',
  MODEL_ADDED: 'model:added',
} as const;

export const API_ROUTES = {
  PROJECTS: '/api/projects',
  UPLOAD: '/api/upload',
  MODELS: '/api/models',
} as const;

export const SERVER_PORT = 3001;
export const WEB_PORT = 3000;

// Supported file extensions
export const SUPPORTED_FORMATS = {
  ifc: ['.ifc'],
  gltf: ['.gltf'],
  glb: ['.glb'],
} as const;

export const ALL_SUPPORTED_EXTENSIONS = [
  ...SUPPORTED_FORMATS.ifc,
  ...SUPPORTED_FORMATS.gltf,
  ...SUPPORTED_FORMATS.glb,
];
