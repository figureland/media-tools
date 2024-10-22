import { $ } from 'bun'
import { fileSize } from '../fs'
import type { VideoManifest } from '../schema'

export const getVideoFPS = async (inputFile: string) => {
  const fps =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of csv=p=0 ${inputFile}`.text()
  const parsedFPS = fps.split('/').map(Number)
  return parsedFPS[0] / parsedFPS[1]
}

export const getVideoDuration = async (inputFile: string): Promise<number> => {
  const durationOutput =
    await $`ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 ${inputFile}`.text()
  return parseFloat(durationOutput.trim())
}

export const getVideoMetadata = async (
  inputFile: string
): Promise<Pick<VideoManifest, 'width' | 'height' | 'duration' | 'size' | 'fps'>> => {
  const width =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=width -of csv=p=0 ${inputFile}`.text()
  const height =
    await $`ffprobe -v error -select_streams v:0 -show_entries stream=height -of csv=p=0 ${inputFile}`.text()

  const size = await fileSize(inputFile)
  const fps = await getVideoFPS(inputFile)
  const duration = await getVideoDuration(inputFile)

  return {
    width: parseInt(width),
    height: parseInt(height),
    duration,
    fps,
    size
  }
}
