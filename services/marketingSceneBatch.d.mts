import type { SceneItem, SceneJob } from './marketingSceneService';
export function runSceneBatch<T>(job: SceneJob, options: {
  progress: (id: string, changes: Record<string, unknown>) => Promise<SceneJob>;
  validate: (item: SceneItem) => Promise<void> | void;
  prepare: (item: SceneItem) => Promise<T>;
  compose: (item: SceneItem, prepared: T, checkpoint: (slide: number) => Promise<SceneJob>) => Promise<{ outputUrl?: string; copy?: unknown; warning?: string }>;
  cancelled?: () => boolean; onJob?: (job: SceneJob) => void; delay?: (ms: number) => Promise<void>;
}): Promise<SceneJob>;
