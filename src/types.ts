import type { VideoManifest } from './schema'

export type FFMpegLogLevel = 'error' | 'warning' | 'info' | 'verbose' | 'quiet'

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
