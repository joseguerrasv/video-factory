import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const PATHS = {
  root: ROOT,
  env: join(ROOT, '.env'),
  envExample: join(ROOT, '.env.example'),
  brands: join(ROOT, 'brands'),
  projects: join(ROOT, 'video-projects'),
  inbox: join(ROOT, 'inbox'),
  state: join(ROOT, '.factory'),
  stateFile: join(ROOT, '.factory', 'state.json'),
  onboarding: join(ROOT, '.factory', 'onboarding'),
  technicalLearnings: join(ROOT, 'learnings', 'technical.md'),
  starter: join(ROOT, 'examples', 'starter'),
};

export const brandDir = (slug) => join(PATHS.brands, slug);
export const projectDir = (slug) => join(PATHS.projects, slug);
