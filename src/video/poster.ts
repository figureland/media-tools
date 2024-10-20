import { $ } from 'bun'
import type { FFMpegLogLevel } from '../types'

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
  const posterFilename = `${filename}.${extension}`
  const posterPath = `${outputFolder}/${posterFilename}`
  const overwriteFlag = overwrite ? '-y' : ''
  await $`ffmpeg ${overwriteFlag} -loglevel ${loglevel} -i ${inputFile} -vf "select=eq(n\\,0)" -vframes 1 -frames:v 1 ${posterPath} `
  return posterFilename
}
