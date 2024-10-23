import { $, which } from 'bun'
import type { VideoManifest } from '../schema'
import { fileSize } from '../fs'
import type { FFMpegLogLevel } from '../types'

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

  const h264name = `${filename}.mp4`
  const vp9name = `${filename}.webm`

  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} \
    -c:v libx264 -crf 23 -preset medium -vf "scale=-2:720" -c:a aac -b:a 128k ${outputFolder}/${h264name} \
    -c:v libvpx-vp9 -crf 30 -b:v 0 -b:a 128k -vf "scale=-2:720" ${outputFolder}/${vp9name}`

  const mp4Size = await fileSize(`${outputFolder}/${h264name}`)
  const vp9Size = await fileSize(`${outputFolder}/${vp9name}`)

  return [
    {
      src: h264name,
      type: 'video/mp4',
      size: mp4Size
    },
    {
      src: vp9name,
      type: 'video/webm',
      size: vp9Size
    }
  ]
}

export const isFFmpegInstalled = async (): Promise<boolean> => {
  try {
    which('ffmpeg')
    which('ffprobe')
    await $`ffmpeg -version`.quiet()

    return true
  } catch (error) {
    return false
  }
}
