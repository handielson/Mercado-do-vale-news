export function createEmptyMediaMigrationCheckpoint() {
  return {
    version: 1,
    generatedAt: new Date().toISOString(),
    uploadsBySha: {},
  };
}

export function stripUploadPayloadsFromPlan(plan) {
  return {
    ...plan,
    actions: (plan.actions || []).map((action) => {
      const { uploadPayloadBase64, ...safeAction } = action;
      return safeAction;
    }),
  };
}

function cloneCheckpoint(checkpoint) {
  return {
    version: checkpoint?.version || 1,
    generatedAt: checkpoint?.generatedAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    uploadsBySha: { ...(checkpoint?.uploadsBySha || {}) },
  };
}

function buildResult(action, status, extra = {}) {
  return {
    status,
    entityType: action.entityType,
    entityId: action.entityId,
    field: action.field,
    sha256: action.sha256,
    plannedPath: action.plannedPath,
    plannedUrl: action.plannedUrl,
    ...extra,
  };
}

export async function applyMediaMigrationPlan(plan, options = {}) {
  if (typeof options.uploader !== 'function') {
    throw new Error('media migration apply requires an uploader');
  }

  const checkpoint = cloneCheckpoint(options.checkpoint || createEmptyMediaMigrationCheckpoint());
  const initiallyUploadedHashes = new Set(Object.keys(checkpoint.uploadsBySha));
  const results = [];

  for (const action of plan.actions || []) {
    if (action.status !== 'planned') {
      results.push(buildResult(action, 'skipped', { reason: action.reason || 'action is not planned' }));
      continue;
    }

    const existing = checkpoint.uploadsBySha[action.sha256];
    if (existing && initiallyUploadedHashes.has(action.sha256)) {
      results.push(buildResult(action, 'already-uploaded', {
        uploadedUrl: existing.url,
        uploadedPath: existing.path,
      }));
      continue;
    }

    if (existing || action.duplicateOf) {
      results.push(buildResult(action, 'deduped', {
        uploadedUrl: existing?.url || action.duplicateOf,
        uploadedPath: existing?.path,
      }));
      continue;
    }

    try {
      const uploaded = await options.uploader(action);
      checkpoint.uploadsBySha[action.sha256] = {
        url: uploaded.url || action.plannedUrl,
        path: uploaded.path || action.plannedPath,
        uploadedAt: new Date().toISOString(),
      };
      results.push(buildResult(action, 'uploaded', {
        uploadedUrl: checkpoint.uploadsBySha[action.sha256].url,
        uploadedPath: checkpoint.uploadsBySha[action.sha256].path,
      }));
    } catch (error) {
      results.push(buildResult(action, 'failed', {
        reason: error?.message || String(error),
      }));
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    mode: 'apply',
    scope: plan.scope,
    summary: {
      total: results.length,
      uploaded: results.filter((result) => result.status === 'uploaded').length,
      alreadyUploaded: results.filter((result) => result.status === 'already-uploaded').length,
      deduped: results.filter((result) => result.status === 'deduped').length,
      skipped: results.filter((result) => result.status === 'skipped').length,
      failed: results.filter((result) => result.status === 'failed').length,
    },
    results,
    checkpoint,
  };
}
