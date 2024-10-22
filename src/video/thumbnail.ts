import { $, which } from 'bun'
import sharp from 'sharp'
import { join } from 'path'
import { unlink, mkdir, rm, readdir } from 'fs/promises'
import type { FFMpegLogLevel } from '../types'
import { getVideoMetadata } from './metadata'
import { VideoManifest } from '../schema'

export const generateThumbnailStrip = async ({
  inputFile,
  outputFolder,
  filename,
  maxHeight = 100,
  overwrite = false,
  loglevel = 'info',
  minThumbnails = 20,
  maxThumbnails = 30
}: {
  inputFile: string
  outputFolder: string
  filename: string
  maxHeight?: number
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
  minThumbnails?: number
  maxThumbnails?: number
}): Promise<VideoManifest['thumbnails']> => {
  const tempFolder = join(outputFolder, 'temp_thumbnails')
  const stripFilename = `${filename}_strip.webp`
  const stripPath = join(outputFolder, stripFilename)
  const overwriteFlag = overwrite ? '-y' : ''

  try {
    // Ensure ffmpeg and ffprobe are available
    await which('ffmpeg')
    await which('ffprobe')

    // Create temp folder if it doesn't exist
    await mkdir(tempFolder, { recursive: true })

    // Get precise video duration using ffprobe

    // Get video metadata
    const { width, height, duration } = await getVideoMetadata(inputFile)
    const aspectRatio = width / height

    // Calculate appropriate interval and number of thumbnails
    const interval = Math.max(
      0.1,
      duration / Math.max(minThumbnails, Math.min(maxThumbnails, duration))
    )
    const actualThumbnails = Math.min(
      maxThumbnails,
      Math.max(minThumbnails, Math.floor(duration / interval))
    )

    // Generate timestamps for snapshots
    const intervalTimestamps = Array.from({ length: actualThumbnails }, (_, i) =>
      Math.min(i * interval, duration - 0.1)
    )

    // Prepare the select filter
    const selectFilter = intervalTimestamps.map((t) => `eq(n,${Math.floor(t * 30)})`).join('+')

    // Extract frames at calculated timestamps
    const ffmpegCommand = [
      'ffmpeg',
      overwriteFlag,
      '-loglevel',
      loglevel,
      '-i',
      inputFile,
      '-vf',
      `select='${selectFilter}',scale=${maxHeight}:-1`,
      '-vsync',
      '0',
      `${tempFolder}/thumb%04d.jpg`
    ].filter(Boolean)

    await $`${ffmpegCommand}`

    // Get list of generated thumbnails in correct order
    const thumbnailFiles = await readdir(tempFolder)
    const thumbnailList = thumbnailFiles
      .filter((file) => file.endsWith('.jpg'))
      .sort((a, b) => {
        const aNum = parseInt(a.match(/\d+/)?.[0] ?? '0')
        const bNum = parseInt(b.match(/\d+/)?.[0] ?? '0')
        return aNum - bNum
      })
      .map((file) => join(tempFolder, file))

    // Resize and combine thumbnails into a strip
    const thumbnailWidth = Math.round(maxHeight * aspectRatio)
    const resizedThumbnails = await Promise.all(
      thumbnailList.map(async (thumb) =>
        sharp(thumb).resize({ height: maxHeight, width: thumbnailWidth, fit: 'fill' }).toBuffer()
      )
    )

    const stripWidth = thumbnailWidth * resizedThumbnails.length
    const stripHeight = maxHeight

    await sharp({
      create: {
        width: stripWidth,
        height: stripHeight,
        channels: 3,
        background: { r: 0, g: 0, b: 0 }
      }
    })
      .composite(
        resizedThumbnails.map((buffer, index) => ({
          input: buffer,
          left: index * thumbnailWidth,
          top: 0
        }))
      )
      .webp({ quality: 90 })
      .toFile(stripPath)

    // Clean up temporary files
    await Promise.all(thumbnailList.map((thumb) => unlink(thumb)))
    await rm(tempFolder, { recursive: true, force: true })

    return {
      src: stripFilename,
      intervals: actualThumbnails,
      width: stripWidth,
      height: stripHeight
    }
  } catch (error) {
    console.error('Error generating thumbnail strip:', error)
    throw error
  }
}
