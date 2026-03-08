import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import type { IFCElementInfo } from './ifc-loader';

export interface ViewerInstance {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  raycaster: THREE.Raycaster;
  loadGLTF: (url: string) => Promise<THREE.Group>;
  loadIFC: (url: string) => Promise<{ group: THREE.Group; elements: IFCElementInfo[] }>;
  highlightElement: (meshId: string, color?: string) => void;
  clearHighlights: () => void;
  getSelectedMeshId: () => string | null;
  onElementSelect: (callback: (meshId: string | null) => void) => void;
  dispose: () => void;
}

export function initViewer(canvas: HTMLCanvasElement): ViewerInstance {
  // Scene setup
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0f);

  // Camera
  const camera = new THREE.PerspectiveCamera(
    60,
    canvas.clientWidth / canvas.clientHeight,
    0.1,
    10000,
  );
  camera.position.set(20, 15, 20);

  // Renderer
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  });
  renderer.setSize(canvas.clientWidth, canvas.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // Controls
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 0, 0);

  // Lighting
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
  dirLight.position.set(10, 20, 10);
  dirLight.castShadow = true;
  scene.add(dirLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 0.3);
  fillLight.position.set(-10, 5, -10);
  scene.add(fillLight);

  // Grid helper
  const gridHelper = new THREE.GridHelper(50, 50, 0x222233, 0x161622);
  scene.add(gridHelper);

  // Raycaster for element picking
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let selectedMeshId: string | null = null;
  const highlightedMeshes = new Map<string, { mesh: THREE.Mesh; originalColor: THREE.Color }>();
  const selectCallbacks: ((meshId: string | null) => void)[] = [];

  // GLTF Loader
  const gltfLoader = new GLTFLoader();

  // Fit camera to loaded model helper
  function fitCameraToModel(object: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(object);
    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);

    if (maxDim === 0) return;

    const scale = 20 / maxDim;
    object.scale.setScalar(scale);
    object.position.sub(center.multiplyScalar(scale));

    controls.target.set(0, 0, 0);
    camera.position.set(maxDim * scale, maxDim * scale * 0.75, maxDim * scale);
    controls.update();
  }

  async function loadGLTF(url: string): Promise<THREE.Group> {
    return new Promise((resolve, reject) => {
      gltfLoader.load(
        url,
        (gltf) => {
          const model = gltf.scene;
          scene.add(model);
          fitCameraToModel(model);
          resolve(model);
        },
        undefined,
        reject,
      );
    });
  }

  async function loadIFC(url: string): Promise<{ group: THREE.Group; elements: IFCElementInfo[] }> {
    const loading = document.getElementById('viewer-loading');
    if (loading) {
      loading.classList.remove('hidden');
      loading.textContent = 'Loading IFC model...';
    }

    try {
      // Dynamic import — only loads web-ifc WASM when first IFC file is opened
      const { loadIFC: loadIFCFile } = await import('./ifc-loader');
      const result = await loadIFCFile(url, (percent) => {
        if (loading) loading.textContent = `Loading IFC... ${percent}%`;
      });

      scene.add(result.group);
      fitCameraToModel(result.group);

      console.log(`IFC viewer: loaded ${result.elements.length} elements`);
      return { group: result.group, elements: result.elements };
    } catch (err) {
      console.error('IFC loading failed:', err);
      if (loading) {
        loading.textContent = `IFC load error: ${err instanceof Error ? err.message : 'Unknown error'}`;
        loading.classList.remove('hidden');
        // Auto-hide error after 5 seconds
        setTimeout(() => loading.classList.add('hidden'), 5000);
      }
      throw err;
    } finally {
      if (loading) loading.classList.add('hidden');
    }
  }

  function highlightElement(meshId: string, color = '#3b82f6'): void {
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh && child.uuid === meshId) {
        const material = child.material as THREE.MeshStandardMaterial;
        if (!highlightedMeshes.has(meshId)) {
          highlightedMeshes.set(meshId, {
            mesh: child,
            originalColor: material.color.clone(),
          });
        }
        material.color.set(color);
        material.emissive.set(color);
        material.emissiveIntensity = 0.3;
      }
    });
  }

  function clearHighlights(): void {
    highlightedMeshes.forEach(({ mesh, originalColor }) => {
      const material = mesh.material as THREE.MeshStandardMaterial;
      material.color.copy(originalColor);
      material.emissive.set(0x000000);
      material.emissiveIntensity = 0;
    });
    highlightedMeshes.clear();
  }

  // Click to select
  canvas.addEventListener('click', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    clearHighlights();

    const hit = intersects.find(
      (i) => i.object instanceof THREE.Mesh && (i.object as THREE.Object3D) !== gridHelper,
    );

    if (hit && hit.object instanceof THREE.Mesh) {
      selectedMeshId = hit.object.uuid;
      highlightElement(selectedMeshId);

      const info = document.getElementById('element-info');
      if (info) {
        const ud = hit.object.userData;
        if (ud?.type) {
          // IFC element — show type and name
          info.textContent = `${ud.type}: ${hit.object.name}`;
        } else {
          info.textContent = hit.object.name || `Element: ${selectedMeshId.slice(0, 8)}`;
        }
      }
    } else {
      selectedMeshId = null;
      const info = document.getElementById('element-info');
      if (info) info.textContent = 'No element selected';
    }

    selectCallbacks.forEach((cb) => cb(selectedMeshId));
  });

  // Resize handler
  function onResize() {
    const parent = canvas.parentElement;
    if (!parent) return;
    const width = parent.clientWidth;
    const height = parent.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  window.addEventListener('resize', onResize);
  // Initial resize to fit container
  requestAnimationFrame(onResize);

  // Animation loop
  let animating = true;
  function animate() {
    if (!animating) return;
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  // Hide loading overlay
  const loading = document.getElementById('viewer-loading');
  if (loading) loading.classList.add('hidden');

  return {
    scene,
    camera,
    renderer,
    controls,
    raycaster,
    loadGLTF,
    loadIFC,
    highlightElement,
    clearHighlights,
    getSelectedMeshId: () => selectedMeshId,
    onElementSelect: (cb) => selectCallbacks.push(cb),
    dispose: () => {
      animating = false;
      window.removeEventListener('resize', onResize);
      controls.dispose();
      renderer.dispose();
    },
  };
}
