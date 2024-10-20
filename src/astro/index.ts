import { z } from 'zod'
import { getVideoManifest } from '../api'

export const video = (source: string) =>
  z.string().transform((data) => getVideoManifest(source, data))
