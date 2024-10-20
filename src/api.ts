import { access, readFile } from 'node:fs/promises'
import { ZodError } from 'zod'
import { join } from 'path'
import type { VideoManifest } from './schema'
import { videoManifestSchema } from '.'

const { parse } = JSON

export const getVideoManifest = async (
  folder: string,
  id: string
): Promise<VideoManifest | null> => {
  const manifestPath = join(folder, `${id}_manifest.json`)

  try {
    await access(manifestPath)
  } catch {
    return null
  }

  try {
    const manifestContent = await readFile(manifestPath, 'utf-8')
    const jsonData = parse(manifestContent)
    const manifest = videoManifestSchema.parse(jsonData)
    return manifest
  } catch (error) {
    if (error instanceof ZodError) {
      console.error('Invalid manifest data:', error.errors)
    } else {
      console.error('Could not find or parse manifest file:', `${id}_manifest.json`)
    }
    return null
  }
}
