import "server-only";

export function publicProductSandbox<T extends object>(sandbox: T): T {
  const record = sandbox as Record<string, unknown>;
  const {
    workspaceMount: _workspaceMount,
    manifest: _manifest,
    ...publicSandbox
  } = record;
  return publicSandbox as T;
}
