import * as THREE from 'three';
import * as WebIFC from 'web-ifc';

let ifcApi: WebIFC.IfcAPI | null = null;

async function getIfcApi(): Promise<WebIFC.IfcAPI> {
  if (ifcApi) return ifcApi;

  ifcApi = new WebIFC.IfcAPI();
  ifcApi.SetWasmPath('/');
  await ifcApi.Init();
  return ifcApi;
}

// IFC type ID to human-readable name mapping (common types)
const IFC_TYPE_NAMES: Record<number, string> = {
  [WebIFC.IFCWALL]: 'IfcWall',
  [WebIFC.IFCWALLSTANDARDCASE]: 'IfcWallStandardCase',
  [WebIFC.IFCSLAB]: 'IfcSlab',
  [WebIFC.IFCCOLUMN]: 'IfcColumn',
  [WebIFC.IFCBEAM]: 'IfcBeam',
  [WebIFC.IFCDOOR]: 'IfcDoor',
  [WebIFC.IFCWINDOW]: 'IfcWindow',
  [WebIFC.IFCROOF]: 'IfcRoof',
  [WebIFC.IFCSTAIR]: 'IfcStair',
  [WebIFC.IFCSTAIRFLIGHT]: 'IfcStairFlight',
  [WebIFC.IFCRAILING]: 'IfcRailing',
  [WebIFC.IFCPLATE]: 'IfcPlate',
  [WebIFC.IFCMEMBER]: 'IfcMember',
  [WebIFC.IFCCURTAINWALL]: 'IfcCurtainWall',
  [WebIFC.IFCFURNISHINGELEMENT]: 'IfcFurnishingElement',
  [WebIFC.IFCBUILDINGELEMENTPROXY]: 'IfcBuildingElementProxy',
  [WebIFC.IFCSPACE]: 'IfcSpace',
  [WebIFC.IFCOPENINGELEMENT]: 'IfcOpeningElement',
  [WebIFC.IFCFLOWSEGMENT]: 'IfcFlowSegment',
  [WebIFC.IFCFLOWTERMINAL]: 'IfcFlowTerminal',
  [WebIFC.IFCFLOWFITTING]: 'IfcFlowFitting',
  [WebIFC.IFCCOVERING]: 'IfcCovering',
  [WebIFC.IFCFOOTING]: 'IfcFooting',
  [WebIFC.IFCPILE]: 'IfcPile',
};

// Color palette for IFC element types
const TYPE_COLORS: Record<string, number> = {
  IfcWall: 0xddddcc,
  IfcWallStandardCase: 0xddddcc,
  IfcSlab: 0xccccbb,
  IfcColumn: 0xaaaacc,
  IfcBeam: 0xaaaacc,
  IfcDoor: 0x8b6914,
  IfcWindow: 0x88bbee,
  IfcRoof: 0xcc8866,
  IfcStair: 0xbbbbaa,
  IfcStairFlight: 0xbbbbaa,
  IfcRailing: 0x999999,
  IfcPlate: 0xaabbcc,
  IfcCurtainWall: 0x88bbee,
  IfcFurnishingElement: 0xcc9966,
  IfcSpace: 0x88aa88,
  IfcCovering: 0xddccbb,
  IfcFooting: 0xaaaaaa,
};

const DEFAULT_COLOR = 0xbbbbbb;

export interface IFCElementInfo {
  expressId: number;
  globalId: string;
  type: string;
  name: string;
}

export interface IFCLoadResult {
  group: THREE.Group;
  elements: IFCElementInfo[];
  modelId: number;
}

export async function loadIFC(
  url: string,
  onProgress?: (percent: number) => void,
): Promise<IFCLoadResult> {
  const api = await getIfcApi();

  // Fetch the IFC file
  onProgress?.(5);
  console.log('[IFC Loader] Fetching:', url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch IFC file: ${response.status} ${response.statusText} (${url})`);
  }
  const buffer = await response.arrayBuffer();
  console.log('[IFC Loader] File size:', buffer.byteLength, 'bytes');
  const data = new Uint8Array(buffer);

  onProgress?.(20);

  // Open the model
  const modelId = api.OpenModel(data);
  const group = new THREE.Group();
  group.name = 'IFC Model';
  const elements: IFCElementInfo[] = [];

  onProgress?.(30);

  // Stream all meshes and convert to Three.js
  let meshCount = 0;
  const geometryCache = new Map<number, THREE.BufferGeometry>();

  api.StreamAllMeshes(modelId, (flatMesh) => {
    const expressId = flatMesh.expressID;

    // Get element info
    let typeName = 'Unknown';
    let elementName = `Element-${expressId}`;
    let globalId = '';

    try {
      const typeId = api.GetLineType(modelId, expressId);
      typeName = IFC_TYPE_NAMES[typeId] ?? `Type-${typeId}`;

      const props = api.GetLine(modelId, expressId);
      if (props?.GlobalId?.value) {
        globalId = props.GlobalId.value;
      }
      if (props?.Name?.value) {
        elementName = props.Name.value;
      }
    } catch {
      // Some elements may not have properties
    }

    // Skip opening elements (holes in walls for doors/windows)
    if (typeName === 'IfcOpeningElement') return;

    const placedGeometries = flatMesh.geometries;

    for (let i = 0; i < placedGeometries.size(); i++) {
      const pg = placedGeometries.get(i);
      const geometryId = pg.geometryExpressID;

      let geometry = geometryCache.get(geometryId);

      if (!geometry) {
        const geomData = api.GetGeometry(modelId, geometryId);
        const vertexData = api.GetVertexArray(
          geomData.GetVertexData(),
          geomData.GetVertexDataSize(),
        );
        const indexData = api.GetIndexArray(
          geomData.GetIndexData(),
          geomData.GetIndexDataSize(),
        );

        geometry = new THREE.BufferGeometry();

        // web-ifc vertex layout: x, y, z, nx, ny, nz (6 floats per vertex)
        const positions = new Float32Array(vertexData.length / 2);
        const normals = new Float32Array(vertexData.length / 2);

        for (let j = 0; j < vertexData.length; j += 6) {
          const idx = j / 2;
          positions[idx] = vertexData[j];
          positions[idx + 1] = vertexData[j + 1];
          positions[idx + 2] = vertexData[j + 2];
          normals[idx] = vertexData[j + 3];
          normals[idx + 1] = vertexData[j + 4];
          normals[idx + 2] = vertexData[j + 5];
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        geometry.setIndex(Array.from(indexData));

        geomData.delete();
        geometryCache.set(geometryId, geometry);
      }

      // Apply transform matrix
      const matrix = new THREE.Matrix4().fromArray(pg.flatTransformation);

      // Material based on type + per-geometry color
      const color = pg.color;
      const opacity = color.w;
      const isTransparent = opacity < 1.0;

      // Use type color or geometry color
      const typeColor = TYPE_COLORS[typeName];
      const matColor = typeColor ?? new THREE.Color(color.x, color.y, color.z).getHex();

      const material = new THREE.MeshStandardMaterial({
        color: matColor,
        side: THREE.DoubleSide,
        transparent: isTransparent,
        opacity: isTransparent ? Math.max(opacity, 0.3) : 1.0,
        roughness: 0.7,
        metalness: 0.1,
      });

      // Skip very transparent elements (like IfcSpace)
      if (opacity < 0.1 && typeName === 'IfcSpace') return;

      const mesh = new THREE.Mesh(geometry.clone(), material);
      mesh.applyMatrix4(matrix);
      mesh.name = elementName;
      mesh.userData = { expressId, globalId, type: typeName };

      group.add(mesh);
      meshCount++;
    }

    elements.push({
      expressId,
      globalId,
      type: typeName,
      name: elementName,
    });
  });

  onProgress?.(90);

  console.log(`IFC loaded: ${meshCount} meshes, ${elements.length} elements`);

  // Close the model to free memory
  api.CloseModel(modelId);

  onProgress?.(100);

  return { group, elements, modelId };
}
