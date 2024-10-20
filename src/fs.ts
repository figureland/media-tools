import { readdir, stat, access } from 'fs/promises'
import { extname, join } from 'path'

export const getFilesInDirectory = async (
  directory: string,
  extensions?: string[]
): Promise<string[]> => {
  const files = await readdir(directory)
  if (!extensions || extensions.length === 0) {
    return files
  }
  return files.filter((file) => extensions.includes(extname(file).toLowerCase()))
}

export const isDirectory = async (path: string): Promise<boolean> => {
  const s = await stat(path)
  return s.isDirectory()
}

export const fileExists = async (
  folder: string,
  name: string,
  extensions: string[]
): Promise<string | null> => {
  for (const ext of extensions) {
    const filePath = join(folder, `${name}${ext}`)
    try {
      await access(filePath)
      return filePath
    } catch {
      continue
    }
  }
  return null
}
