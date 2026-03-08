import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { Project } from '@bentar/shared';

const router = Router();

// In-memory store for MVP
const projects = new Map<string, Project>();

export function getProjectById(id: string): Project | undefined {
  return projects.get(id);
}

export function addModelToProject(projectId: string, model: import('@bentar/shared').ModelFile): void {
  const project = projects.get(projectId);
  if (project) {
    project.models.push(model);
    project.updatedAt = new Date().toISOString();
  }
}

// GET /api/projects
router.get('/', (_req, res) => {
  const list = Array.from(projects.values()).map(({ id, name, description, createdAt, updatedAt, models, members }) => ({
    id,
    name,
    description,
    createdAt,
    updatedAt,
    modelCount: models.length,
    memberCount: members.length,
  }));
  res.json(list);
});

// POST /api/projects
router.post('/', (req, res) => {
  const { name, description } = req.body as { name?: string; description?: string };

  if (!name) {
    res.status(400).json({ error: 'Project name is required' });
    return;
  }

  const project: Project = {
    id: uuidv4(),
    name,
    description: description ?? '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    models: [],
    members: [],
  };

  projects.set(project.id, project);
  res.status(201).json(project);
});

// GET /api/projects/:id
router.get('/:id', (req, res) => {
  const project = projects.get(req.params.id);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json(project);
});

export { router as projectsRouter };
