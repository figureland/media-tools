import { z } from 'zod'

export const videoManifestSchema = z.object({
  id: z.string(),
  sources: z.array(
    z.object({
      src: z.string(),
      type: z.string(),
      size: z.number()
    })
  ),
  thumbnails: z.object({
    src: z.string(),
    intervals: z.number(),
    width: z.number(),
    height: z.number()
  }),
  poster: z.string(),
  width: z.number(),
  height: z.number(),
  duration: z.number(),
  size: z.number(),
  hash: z.string(),
  fps: z.number()
})

export type VideoManifest = z.infer<typeof videoManifestSchema>

export const isVideoManifest = (media: unknown): media is VideoManifest =>
  videoManifestSchema.safeParse(media).success
