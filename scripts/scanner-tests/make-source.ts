import type { RepoSource, RepoTreeItem } from '../../netlify/scanner-core/analyze'

export function makeSource(
  files: Record<string, string>,
  options?: { now?: () => number },
): RepoSource {
  const tree: RepoTreeItem[] = Object.keys(files).map((path) => ({
    path,
    type: 'blob',
    size: Buffer.byteLength(files[path], 'utf8'),
  }))

  return {
    tree,
    getFile: async (path: string) => {
      if (Object.prototype.hasOwnProperty.call(files, path)) {
        return files[path]
      }
      return null
    },
    now: options?.now ? options.now : () => Date.now(),
  }
}
