import { $ } from 'bun'
import type { FFMpegLogLevel } from '../types'

export const generatePosterImage = async ({
  inputFile,
  outputFolder,
  filename,
  overwrite = false,
  loglevel = 'info'
}: {
  inputFile: string
  outputFolder: string
  filename: string
  timestamp?: number
  overwrite?: boolean
  loglevel?: FFMpegLogLevel
}) => {
  const posterFilename = `${filename}.webp`
  const posterPath = `${outputFolder}/${posterFilename}`
  const overwriteFlag = overwrite ? '-y' : ''

  // Generate WebP poster directly
  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} -vf "select=eq(n\\,0)" -vframes 1 -frames:v 1 ${posterPath}`

  return posterFilename
}
