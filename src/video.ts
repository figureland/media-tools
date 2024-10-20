import { $ } from 'bun'
import { mkdir, stat, access } from 'fs/promises'
import { parse, join, basename, relative, extname } from 'path'
import type { VideoManifest } from './schema'
import { generateManifest } from './manifest'
import { getFileHash } from './hash'
import { getVideoManifest } from './api'
import { fileExists, getFilesInDirectory, isDirectory } from './fs'

export const getVideoMetadata = async (inputFile: string) => {
  const width =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 ${inputFile}`.text()
  const height =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 ${inputFile}`.text()
  const duration =
    await $`ffprobe -v error -show_entries format=duration -of csv=p=0 ${inputFile}`.text()
  const size = (await stat(inputFile)).size

  return {
    width: parseInt(width),
    height: parseInt(height),
    duration: parseFloat(duration),
    size: size
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
}) => {
  const overwriteFlag = overwrite ? '-y' : ''

  const h264 = `${filename}_h264.mp4`
  const vp9 = `${filename}_vp9.webm`

  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} \
    -c:v libx264 -crf 23 -preset medium -vf "scale=-2:720" -c:a aac -b:a 128k ${outputFolder}/${h264} \
    -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -vf "scale=-2:720" ${outputFolder}/${vp9}`

  return [
    {
      filename: h264,
      type: 'video/mp4'
    },
    {
      filename: vp9,
      type: 'video/webm'
    }
  ]
}

type VideoProcessingResult =
  | {
      status: 'unchanged' | 'success'
      manifest: VideoManifest
    }
  | {
      status: 'error'
    }

export const processVideo = async ({
  outputFolder,
  file,
  baseDir,
  overwrite = false,
  loglevel = 'info'
}: {
  outputFolder: string
  file: string
  baseDir: string
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}): Promise<VideoProcessingResult> => {
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

    const manifestPath = join(targetDir, `${id}_manifest.json`)

    const existingManifest = await getVideoManifest(targetDir, id)

    if (existingManifest && hash === existingManifest.hash) {
      return {
        status: 'unchanged',
        manifest: existingManifest
      }
    }

    console.log(`Processing ${filename}...`)

    const sources = await generateVideo({
      inputFile,
      outputFolder,
      filename: `${id}_${shortHash}`,
      overwrite,
      loglevel
    })

    const posterPath = await generatePosterImage({
      inputFile,
      outputFolder,
      filename: `${id}_${shortHash}_poster`,
      loglevel
    })

    const metadata = await getVideoMetadata(inputFile)

    const manifest = await generateManifest(manifestPath, {
      id,
      hash,
      sources: sources.map(({ filename, type }) => ({
        src: `${baseDir}/${filename}`,
        type
      })),
      poster: `/${relative('public', posterPath)}`,
      ...metadata
    })

    console.log(`Finished processing ${filename}`)
    console.log(`Output files and manifest are in ${outputFolder}`)

    return {
      status: 'success',
      manifest
    }
  } catch (error) {
    console.error(error)
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
  input,
  outputFolder
}: {
  input: string
  outputFolder: string
}) => {
  try {
    await access(input)
  } catch (error) {
    console.error(`Error: The input "${input}" does not exist or is not accessible.`)
    process.exit(1)
  }

  const hasFFmpeg = await isFFmpegInstalled()

  if (!hasFFmpeg) {
    console.error('Error: ffmpeg is not installed.')
    process.exit(1)
  }

  await mkdir(outputFolder, { recursive: true })

  const results: VideoProcessingResult[] = []

  const isDir = await isDirectory(input)

  if (isDir) {
    const videoFiles = await getFilesInDirectory(input, ['.mp4', '.mov'])

    if (videoFiles.length === 0) {
      console.log(
        `No video files found in "${input}". Please make sure the directory contains .mp4 or .mov files.`
      )
      process.exit(0)
    }

    for (const f of videoFiles) {
      const file = join(input, f)
      const result = await processVideo({
        outputFolder,
        file,
        baseDir: '/converted/',
        overwrite: true,
        loglevel: 'info'
      })
      if (result) {
        results.push(result)
      }
    }

    console.log('All videos processed.')
  } else {
    // Process single file
    if (!['.mp4', '.mov'].includes(extname(input).toLowerCase())) {
      console.error(`Error: The file "${input}" is not a supported video format (.mp4 or .mov).`)
      process.exit(1)
    }

    const result = await processVideo({
      outputFolder,
      file: input,
      baseDir: '/converted/',
      overwrite: true,
      loglevel: 'info'
    })

    if (result) {
      results.push(result)
    }

    console.log('Video processed.')
  }
  return collectResults(results)
}

export const collectResults = (results: VideoProcessingResult[]) => {
  const success = results.filter((r) => r.status === 'success')
  const unchanged = results.filter((r) => r.status === 'unchanged')
  const errors = results.filter((r) => r.status === 'error')

  return {
    success,
    unchanged,
    errors
  }
}
