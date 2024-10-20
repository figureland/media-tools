import { $ } from 'bun'
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
  loglevel = 'info'
}: {
  inputFile: string
  outputFolder: string
  filename: string
  maxHeight?: number
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}): Promise<VideoManifest['thumbnails']> => {
  const tempFolder = join(outputFolder, 'temp_thumbnails')
  const stripFilename = `${filename}_strip.webp`
  const stripPath = join(outputFolder, stripFilename)
  const overwriteFlag = overwrite ? '-y' : ''

  try {
    // Get video metadata
    const { width, height, duration } = await getVideoMetadata(inputFile)
    const aspectRatio = width / height

    // Calculate appropriate interval
    const maxThumbnails = 30
    const interval = Math.max(1, Math.ceil(duration / maxThumbnails))
    const actualThumbnails = Math.min(maxThumbnails, Math.floor(duration / interval))

    // Create temporary folder for individual thumbnails
    await mkdir(tempFolder, { recursive: true })

    // Generate timestamps for snapshots
    const intervalTimestamps = Array.from({ length: actualThumbnails }, (_, i) => i * interval)

    // Extract frames at calculated timestamps
    for (let i = 0; i < intervalTimestamps.length; i++) {
      const time = intervalTimestamps[i]
      await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -ss ${time} -i ${inputFile} -vframes 1 ${tempFolder}/thumb${i.toString().padStart(4, '0')}.jpg`
    }

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
