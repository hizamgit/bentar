import * as THREE from 'three';
import type { ViewerInstance } from './viewer';
import type { ModelFile, BIMElement } from '@bentar/shared';

export interface LoadedModel {
  file: ModelFile;
  elements: BIMElement[];
}

export async function loadModel(
  viewer: ViewerInstance,
  model: ModelFile,
): Promise<LoadedModel> {
  const elements: BIMElement[] = [];

  switch (model.format) {
    case 'glb':
    case 'gltf': {
      const group = await viewer.loadGLTF(model.path);
      // Extract element info from loaded group
      group.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          elements.push({
            globalId: child.uuid,
            modelId: model.id,
            ifcType: 'Mesh',
            name: child.name || `Mesh-${child.uuid.slice(0, 6)}`,
            properties: [],
          });
        }
      });
      break;
    }

    case 'ifc': {
      const { loadIFC: loadIFCFile } = await import('./ifc-loader');
      const result = await loadIFCFile(model.path);
      viewer.scene.add(result.group);
      // Convert IFC elements to BIMElement format
      result.elements.forEach((el) => {
        elements.push({
          globalId: el.globalId || `ifc-${el.expressId}`,
          modelId: model.id,
          ifcType: el.type,
          name: el.name,
          properties: [],
        });
      });
      break;
    }

    case 'fragments': {
      console.warn('Fragments format loading not yet implemented.');
      break;
    }
  }

  return { file: model, elements };
}

// Render element tree in sidebar
export function renderElementTree(
  container: HTMLElement,
  elements: BIMElement[],
  onSelect?: (elementId: string) => void,
): void {
  if (elements.length === 0) {
    container.innerHTML = '<p class="empty">No elements in model</p>';
    return;
  }

  const html = elements.map((el) => `
    <div class="tree-item" data-element-id="${el.globalId}">
      <span class="tree-icon">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="18" height="18" rx="2"/>
        </svg>
      </span>
      <span>${el.name}</span>
    </div>
  `).join('');

  container.innerHTML = html;

  if (onSelect) {
    container.querySelectorAll('.tree-item').forEach((item) => {
      item.addEventListener('click', () => {
        const id = (item as HTMLElement).dataset.elementId;
        if (id) onSelect(id);

        container.querySelectorAll('.tree-item').forEach((i) => i.classList.remove('selected'));
        item.classList.add('selected');
      });
    });
  }
}
