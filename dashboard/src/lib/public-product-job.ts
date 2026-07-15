import "server-only";

function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function publicProductJob<T extends Record<string, unknown>>(job: T): T {
  const result = object(job.result);
  if (!result) return job;

  const workspace = object(result.workspace);
  if (!workspace) return job;

  const {
    mountPath: _mountPath,
    repositoryRoot: _repositoryRoot,
    ...publicWorkspace
  } = workspace;

  return {
    ...job,
    result: {
      ...result,
      workspace: publicWorkspace,
    },
  } as T;
}
