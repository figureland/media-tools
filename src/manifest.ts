import { type VideoManifest } from './schema'
import { write } from 'bun'

const { stringify } = JSON

export const generateManifest = async (folder: string, manifest: VideoManifest) => {
  await write(folder, stringify(manifest, null, 2))
  return manifest
}
