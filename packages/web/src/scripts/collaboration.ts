import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  User,
  UserPresence,
  ChatMessage,
  ModelFile,
} from '@bentar/shared';
import type { ViewerInstance } from './viewer';

type CollabSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

// Generate a random user for this session (MVP — no auth yet)
function createSessionUser(): User {
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316'];
  const id = crypto.randomUUID();
  return {
    id,
    name: `User-${id.slice(0, 4)}`,
    email: '',
    color: colors[Math.floor(Math.random() * colors.length)],
    source: 'web',
  };
}

export function initCollaboration(projectId: string, viewer: ViewerInstance) {
  const socket: CollabSocket = io({ transports: ['websocket'] });
  const user = createSessionUser();

  const usersListEl = document.getElementById('users-list');
  const userCountEl = document.getElementById('user-count');
  const chatMessagesEl = document.getElementById('chat-messages');
  const chatForm = document.getElementById('chat-form') as HTMLFormElement | null;
  const chatInput = document.getElementById('chat-input') as HTMLInputElement | null;
  const connectionStatus = document.getElementById('connection-status');
  const modelsListEl = document.getElementById('models-list');
  const uploadInput = document.getElementById('model-upload') as HTMLInputElement | null;

  // Connection status
  socket.on('connect', () => {
    if (connectionStatus) {
      connectionStatus.classList.remove('disconnected');
      connectionStatus.classList.add('connected');
      connectionStatus.title = 'Connected';
    }
    socket.emit('room:join', { projectId, user });
  });

  socket.on('disconnect', () => {
    if (connectionStatus) {
      connectionStatus.classList.remove('connected');
      connectionStatus.classList.add('disconnected');
      connectionStatus.title = 'Disconnected';
    }
  });

  // Room state (received on join)
  socket.on('room:state', (state) => {
    renderUsers(state.users);
    renderModels(state.models);

    // Load any existing models
    state.models.forEach((model) => {
      if (model.format === 'glb' || model.format === 'gltf') {
        viewer.loadGLTF(model.path);
      } else if (model.format === 'ifc') {
        viewer.loadIFC(model.path);
      }
    });
  });

  // User events
  socket.on('room:user-joined', (presence) => {
    addUserToList(presence);
  });

  socket.on('room:user-left', ({ userId }) => {
    removeUserFromList(userId);
    viewer.clearHighlights();
  });

  // Element selection sync
  socket.on('element:selected', (selection) => {
    if (selection.userId !== user.id) {
      // Find the user's color
      const userEl = document.querySelector(`[data-user-id="${selection.userId}"]`);
      const color = userEl?.getAttribute('data-user-color') ?? '#ef4444';
      selection.elementIds.forEach((id) => viewer.highlightElement(id, color));
    }
  });

  // Chat
  socket.on('chat:new-message', (message) => {
    appendChatMessage(message);
  });

  // New model notification
  socket.on('model:added', (model) => {
    addModelToList(model);
    if (model.format === 'glb' || model.format === 'gltf') {
      viewer.loadGLTF(model.path);
    } else if (model.format === 'ifc') {
      viewer.loadIFC(model.path);
    }
  });

  // Send element selection
  viewer.onElementSelect((meshId) => {
    socket.emit('element:select', {
      userId: user.id,
      elementIds: meshId ? [meshId] : [],
      modelId: '',
    });
  });

  // Chat form
  chatForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const message = chatInput?.value.trim();
    if (message) {
      socket.emit('chat:message', { projectId, message });
      if (chatInput) chatInput.value = '';
    }
  });

  // File upload
  uploadInput?.addEventListener('change', async () => {
    const file = uploadInput.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('model', file);
    formData.append('projectId', projectId);
    formData.append('userId', user.id);

    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (res.ok) {
        const model: ModelFile = await res.json();
        socket.emit('model:upload-complete', { projectId, model });
        addModelToList(model);

        if (model.format === 'glb' || model.format === 'gltf') {
          await viewer.loadGLTF(model.path);
        } else if (model.format === 'ifc') {
          await viewer.loadIFC(model.path);
        }
      }
    } catch (err) {
      console.error('Upload failed:', err);
    }
    uploadInput.value = '';
  });

  // --- Render helpers ---

  function renderUsers(users: UserPresence[]) {
    if (!usersListEl) return;
    if (users.length === 0) {
      usersListEl.innerHTML = '<li class="empty">No users online</li>';
    } else {
      usersListEl.innerHTML = users.map((p) => userItemHTML(p)).join('');
    }
    if (userCountEl) userCountEl.textContent = String(users.length);
  }

  function addUserToList(presence: UserPresence) {
    if (!usersListEl) return;
    const empty = usersListEl.querySelector('.empty');
    if (empty) empty.remove();
    usersListEl.insertAdjacentHTML('beforeend', userItemHTML(presence));
    if (userCountEl) {
      userCountEl.textContent = String(usersListEl.children.length);
    }
  }

  function removeUserFromList(userId: string) {
    const el = document.querySelector(`[data-user-id="${userId}"]`);
    el?.remove();
    if (usersListEl && userCountEl) {
      const count = usersListEl.querySelectorAll('.user-item').length;
      userCountEl.textContent = String(count);
      if (count === 0) {
        usersListEl.innerHTML = '<li class="empty">No users online</li>';
      }
    }
  }

  function userItemHTML(p: UserPresence): string {
    const initials = p.user.name.slice(0, 2).toUpperCase();
    return `
      <li class="user-item" data-user-id="${p.user.id}" data-user-color="${p.user.color}">
        <span class="user-avatar" style="background:${p.user.color}">${initials}</span>
        <span>${p.user.name}</span>
        <span class="user-source">${p.user.source}</span>
      </li>
    `;
  }

  function renderModels(models: ModelFile[]) {
    if (!modelsListEl) return;
    if (models.length === 0) {
      modelsListEl.innerHTML = '<p class="empty">No models loaded</p>';
    } else {
      modelsListEl.innerHTML = models.map(modelItemHTML).join('');
    }
  }

  function addModelToList(model: ModelFile) {
    if (!modelsListEl) return;
    const empty = modelsListEl.querySelector('.empty');
    if (empty) empty.remove();
    modelsListEl.insertAdjacentHTML('beforeend', modelItemHTML(model));
  }

  function modelItemHTML(m: ModelFile): string {
    return `
      <div class="model-item" data-model-id="${m.id}">
        <span class="model-format">${m.format}</span>
        <span>${m.originalFilename}</span>
      </div>
    `;
  }

  function appendChatMessage(msg: ChatMessage) {
    if (!chatMessagesEl) return;
    const empty = chatMessagesEl.querySelector('.empty');
    if (empty) empty.remove();

    const time = new Date(msg.timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    chatMessagesEl.insertAdjacentHTML(
      'beforeend',
      `<div class="chat-msg">
        <div class="chat-msg-name">${msg.userName}<span class="chat-msg-time">${time}</span></div>
        <div class="chat-msg-text">${escapeHTML(msg.message)}</div>
      </div>`,
    );
    chatMessagesEl.scrollTop = chatMessagesEl.scrollHeight;
  }

  function escapeHTML(str: string): string {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    socket.emit('room:leave', { projectId });
    socket.disconnect();
  });
}
