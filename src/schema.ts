import { z } from 'zod'

export const videoManifestSchema = z.object({
  id: z.string(),
  sources: z.array(
    z.object({
      src: z.string(),
      type: z.string()
    })
  ),
  poster: z.string(),
  width: z.number(),
  height: z.number(),
  duration: z.number(),
  size: z.number(),
  hash: z.string()
})

export type VideoManifest = z.infer<typeof videoManifestSchema>

export const isVideoManifest = (media: unknown): media is VideoManifest =>
  videoManifestSchema.safeParse(media).success
