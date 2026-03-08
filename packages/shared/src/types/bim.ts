export interface BIMProperty {
  name: string;
  value: string | number | boolean;
  type: string;
  propertySet?: string;
}

export interface BIMElement {
  globalId: string;
  modelId: string;
  ifcType: string;
  name: string;
  description?: string;
  properties: BIMProperty[];
  parentId?: string;
  children?: string[];
}

export interface BIMSpatialNode {
  globalId: string;
  name: string;
  type: 'project' | 'site' | 'building' | 'storey' | 'space';
  children: BIMSpatialNode[];
  elementCount: number;
}
