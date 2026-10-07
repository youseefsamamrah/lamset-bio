/** Resolve a file in public/ under Vite's deployment base path. */
export function publicAsset(path: string): string {
  const base = import.meta.env.BASE_URL || "/";
  return `${base.replace(/\/$/, "")}/${path.replace(/^\/+/, "")}`;
}
