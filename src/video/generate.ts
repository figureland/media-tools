import { mkdir } from 'fs/promises'
import { parse, join, basename, resolve } from 'path'
import type { VideoManifest } from '../schema'
import { generateManifest } from '../manifest'
import { getFileHash } from '../hash'
import { getVideoManifest } from '../api'
import { fileExists } from '../fs'
import { print } from '../log'
import type {
  FFMpegLogLevel,
  VideoProcessingErrorResult,
  VideoProcessingResult,
  VideoProcessingSuccessResult,
  VideoProcessingUnchangedResult
} from '../types'
import { generatePosterImage } from './poster'
import { getVideoMetadata } from './metadata'
import { generateVideo } from './ffmpeg'
import { generateThumbnailStrip } from './thumbnail'

export const processVideo = async ({
  outputFolder,
  file,
  baseDir = '/',
  overwrite = false,
  loglevel = 'info'
}: {
  outputFolder: string
  file: string
  baseDir?: string
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}): Promise<VideoProcessingResult> => {
  const startTime = performance.now()
  try {
    const { name: inputFileBase, dir: inputFileDir } = parse(file)

    const inputFile = await fileExists(inputFileDir, inputFileBase, ['.mp4', '.mov'])

    if (!inputFile) {
      throw new Error(`No .mp4 or .mov file found for ${inputFileBase}`)
    }

    const targetDir = join(process.cwd(), outputFolder)

    await mkdir(targetDir, {
      recursive: true
    })

    const filename = basename(inputFile)
    const id = parse(filename).name

    const { hash, shortHash } = await getFileHash(inputFile)

    const manifestPath = join(targetDir, `${id}.manifest.json`)

    const existingManifest = await getVideoManifest(targetDir, id)

    if (existingManifest && hash === existingManifest.hash) {
      return {
        status: 'unchanged',
        manifest: existingManifest
      }
    }

    print.log({ message: [`Processing ${filename}...`], color: 'white' })

    const sources = await generateVideo({
      inputFile,
      outputFolder,
      filename: `${id}.${shortHash}`,
      overwrite,
      loglevel
    })

    const posterPath = await generatePosterImage({
      inputFile,
      outputFolder,
      filename: `${id}_poster.${shortHash}`,
      loglevel
    })

    const thumbnails = await generateThumbnailStrip({
      inputFile,
      outputFolder,
      filename: `${id}_strip.${shortHash}`,
      overwrite,
      loglevel
    })

    const metadata = await getVideoMetadata(inputFile)

    const manifest = await generateManifest(manifestPath, {
      id,
      hash,
      sources: sources.map(({ src, ...rest }) => ({
        src: resolve(baseDir, src),
        ...rest
      })),
      thumbnails: {
        ...thumbnails,
        src: resolve(baseDir, thumbnails.src)
      },
      poster: resolve(baseDir, posterPath),
      ...metadata
    })
    const endTime = performance.now()
    const elapsedTime = ((endTime - startTime) / 1000).toFixed(2)

    print.log({ message: [`Optimised ${filename} (${elapsedTime}s)`] })
    for (const source of manifest.sources) {
      const sizeInMB = (source.size / (1024 * 1024)).toFixed(2)
      const percentReduction = ((1 - source.size / metadata.size) * 100).toFixed(0)
      print.log({
        message: [`∟ ${source.type} (${sizeInMB}mb, ${percentReduction}% smaller)`]
      })
    }
    return {
      status: 'success',
      manifest
    }
  } catch (error) {
    return {
      status: 'error'
    }
  }
}

export const processVideos = async ({
  files,
  outputFolder,
  baseDir = '/',
  loglevel = 'info'
}: {
  files: string[]
  outputFolder: string
  baseDir?: string
  loglevel?: FFMpegLogLevel
}) => {
  const results: VideoProcessingResult[] = []

  print.log({
    message: [`Processing ${files.length} videos`]
  })

  for (const file of files) {
    const result = await processVideo({
      outputFolder,
      file,
      baseDir,
      overwrite: true,
      loglevel
    })
    if (result) {
      results.push(result)
    }
  }

  return collectResults(results)
}

export const collectResults = (
  results: VideoProcessingResult[]
): {
  success: VideoProcessingSuccessResult[]
  unchanged: VideoProcessingUnchangedResult[]
  errors: VideoProcessingErrorResult[]
} => {
  const success = results.filter(
    (r): r is { status: 'success'; manifest: VideoManifest } => r.status === 'success'
  )
  const unchanged = results.filter(
    (r): r is { status: 'unchanged'; manifest: VideoManifest } => r.status === 'unchanged'
  )
  const errors = results.filter((r) => r.status === 'error')

  return {
    success,
    unchanged,
    errors
  }
}

export const isSuccessfulResult = (
  result: VideoProcessingResult
): result is VideoProcessingSuccessResult | VideoProcessingUnchangedResult =>
  result.status === 'success' || result.status === 'unchanged'
