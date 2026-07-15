import "server-only";

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function publicProductJob<T extends object>(job: T): T {
  const record = job as Record<string, unknown>;
  const result = object(record.result);
  if (!result) return job;

  const workspace = object(result.workspace);
  if (!workspace) return job;

  const {
    mountPath: _mountPath,
    repositoryRoot: _repositoryRoot,
    ...publicWorkspace
  } = workspace;

  return {
    ...record,
    result: {
      ...result,
      workspace: publicWorkspace,
    },
  } as T;
}
