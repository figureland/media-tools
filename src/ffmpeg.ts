import { $ } from 'bun'
import { access, mkdir, stat } from 'fs/promises'
import { parse, join, basename, relative } from 'path'
import type { VideoManifest } from './schema'
import { generateManifest } from './manifest'
import { getFileHash } from './hash'
import { getVideoManifest } from './api'

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
}): Promise<VideoManifest | null> => {
  const { name: inputFileBase, dir: inputFileDir } = parse(file)

  let inputFile = ''
  try {
    await access(join(inputFileDir, `${inputFileBase}.mp4`))
    inputFile = join(inputFileDir, `${inputFileBase}.mp4`)
  } catch {
    try {
      await access(join(inputFileDir, `${inputFileBase}.mov`))
      inputFile = join(inputFileDir, `${inputFileBase}.mov`)
    } catch {
      console.error(`Error: No .mp4 or .mov file found for ${inputFileBase}`)
      // process.exit(1);
    }
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
    return existingManifest
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

  return manifest
}
