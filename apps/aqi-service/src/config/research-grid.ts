import { readFileSync } from 'fs';
import { resolve } from 'path';

export interface ResearchGridPointConfig {
  id: string;
  name: string;
  lat: number;
  lon: number;
}

export interface ResearchGridConfig {
  version: string;
  study_area: string;
  source: string;
  created_at: string;
  points: ResearchGridPointConfig[];
}

const EXPECTED_GRID_POINT_COUNT = 25;
const GRID_POINT_CODE_PATTERN = /^HCMC-G\d{3}$/;

export function loadResearchGridConfig(configPath: string): ResearchGridConfig {
  const absolutePath = resolve(process.cwd(), configPath);
  const parsed: unknown = JSON.parse(readFileSync(absolutePath, 'utf8'));

  if (!parsed || typeof parsed !== 'object') {
    throw new Error(`Research grid must be a JSON object: ${absolutePath}`);
  }

  const grid = parsed as Partial<ResearchGridConfig>;
  if (!grid.version || !grid.study_area || !grid.source || !grid.created_at) {
    throw new Error(`Research grid metadata is incomplete: ${absolutePath}`);
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(grid.created_at)) {
    throw new Error(`Research grid created_at must use YYYY-MM-DD: ${absolutePath}`);
  }
  if (!Array.isArray(grid.points) || grid.points.length !== EXPECTED_GRID_POINT_COUNT) {
    throw new Error(
      `Research grid ${grid.version} must contain exactly ${EXPECTED_GRID_POINT_COUNT} points`,
    );
  }

  const codes = new Set<string>();
  const coordinates = new Set<string>();
  for (const point of grid.points) {
    if (!GRID_POINT_CODE_PATTERN.test(point.id) || codes.has(point.id)) {
      throw new Error(`Invalid or duplicate research grid point code: ${point.id}`);
    }
    if (!point.name?.trim()) {
      throw new Error(`Research grid point ${point.id} has no name`);
    }
    if (!Number.isFinite(point.lat) || point.lat < -90 || point.lat > 90) {
      throw new Error(`Research grid point ${point.id} has invalid latitude`);
    }
    if (!Number.isFinite(point.lon) || point.lon < -180 || point.lon > 180) {
      throw new Error(`Research grid point ${point.id} has invalid longitude`);
    }
    const coordinateKey = `${point.lat},${point.lon}`;
    if (coordinates.has(coordinateKey)) {
      throw new Error(`Duplicate research grid coordinates at point: ${point.id}`);
    }
    codes.add(point.id);
    coordinates.add(coordinateKey);
  }

  return grid as ResearchGridConfig;
}
