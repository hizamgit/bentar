export interface User {
  id: string;
  name: string;
  email: string;
  color: string;
  avatar?: string;
  source: 'web' | 'revit' | 'archicad' | 'sketchup' | 'blender' | 'maya' | 'rhino';
}

export type ModelFormat = 'ifc' | 'gltf' | 'glb' | 'fragments' | '3dm';

export interface ModelFile {
  id: string;
  projectId: string;
  filename: string;
  originalFilename: string;
  format: ModelFormat;
  size: number;
  uploadedBy: string;
  uploadedAt: string;
  path: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  models: ModelFile[];
  members: ProjectMember[];
}

export interface ProjectMember {
  userId: string;
  role: 'owner' | 'editor' | 'viewer';
  joinedAt: string;
}
