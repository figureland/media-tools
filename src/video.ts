import { $ } from 'bun'
import { mkdir } from 'fs/promises'
import { parse, join, basename, relative } from 'path'
import type { VideoManifest } from './schema'
import { generateManifest } from './manifest'
import { getFileHash } from './hash'
import { getVideoManifest } from './api'
import { fileExists, fileSize } from './fs'
import { print } from './log'

export const getVideoFPS = async (inputFile: string) => {
  const fps =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 ${inputFile}`.text()
  const parsedFPS = fps.split('/').map(Number)
  return parsedFPS[0] / parsedFPS[1]
}

export const getVideoMetadata = async (
  inputFile: string
): Promise<Pick<VideoManifest, 'width' | 'height' | 'duration' | 'size' | 'fps'>> => {
  const width =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 ${inputFile}`.text()
  const height =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 ${inputFile}`.text()
  const duration =
    await $`ffprobe -v error -show_entries format=duration -of csv=p=0 ${inputFile}`.text()

  const size = await fileSize(inputFile)

  const fps = await getVideoFPS(inputFile)
  return {
    width: parseInt(width),
    height: parseInt(height),
    duration: parseFloat(duration),
    fps,
    size
  }
}

type FFMpegLogLevel = 'error' | 'warning' | 'info' | 'verbose' | 'quiet'

export const generatePosterImage = async ({
  inputFile,
  outputFolder,
  filename,
  overwrite = false,
  extension = 'jpg',
  loglevel = 'info'
}: {
  inputFile: string
  outputFolder: string
  filename: string
  timestamp?: number
  extension?: 'jpg' | 'png'
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}) => {
  const posterPath = `${outputFolder}/${filename}.${extension}`
  const overwriteFlag = overwrite ? '-y' : ''
  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} -vf "select=eq(n\\,0)" -vframes 1 -frames:v 1 ${posterPath} `
  return posterPath
}

export const generateVideo = async ({
  inputFile,
  outputFolder,
  filename,
  overwrite = false,
  loglevel = 'info'
}: {
  inputFile: string
  outputFolder: string
  filename: string
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}): Promise<VideoManifest['sources']> => {
  const overwriteFlag = overwrite ? '-y' : ''

  const h264 = `${filename}.mp4`
  const vp9 = `${filename}.webm`

  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} \
    -c:v libx264 -crf 23 -preset medium -vf "scale=-2:720" -c:a aac -b:a 128k ${outputFolder}/${h264} \
    -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -vf "scale=-2:720" ${outputFolder}/${vp9}`

  const mp4Size = await fileSize(`${outputFolder}/${h264}`)
  const vp9Size = await fileSize(`${outputFolder}/${vp9}`)

  return [
    {
      src: h264,
      type: 'video/mp4',
      size: mp4Size
    },
    {
      src: vp9,
      type: 'video/webm',
      size: vp9Size
    }
  ]
}

export type VideoProcessingUnchangedResult = {
  status: 'unchanged'
  manifest: VideoManifest
}

export type VideoProcessingSuccessResult = {
  status: 'success'
  manifest: VideoManifest
}

export type VideoProcessingErrorResult = {
  status: 'error'
}

export type VideoProcessingResult =
  | VideoProcessingUnchangedResult
  | VideoProcessingSuccessResult
  | VideoProcessingErrorResult

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

    const metadata = await getVideoMetadata(inputFile)

    const manifest = await generateManifest(manifestPath, {
      id,
      hash,
      sources: sources.map(({ src, ...rest }) => ({
        src: `${baseDir}/${src}`,
        ...rest
      })),
      poster: `/${relative('public', posterPath)}`,
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

export const isFFmpegInstalled = async (): Promise<boolean> => {
  try {
    await $`ffmpeg -version`.quiet()
    return true
  } catch (error) {
    return false
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
