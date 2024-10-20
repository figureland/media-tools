import { co2 } from '@tgwf/co2'
import type { VideoManifest } from './schema'
import type { VideoProcessingSuccessResult } from './video'
import { print } from './log'
import { isNumber } from '@figureland/kit/ts/guards'

const swd = new co2({ model: 'swd' })
const co2e = (bytes: number) => Number(swd.perByte(bytes))

export const getVideoCO2eReport = (manifest: VideoManifest) => {
  // Average size per optimised video
  const averageOptimisedSize = average(manifest.sources, 'size')

  // Total original CO2e for the video
  const originalCO2e = co2e(manifest.size)

  // Average CO2e for optimised video
  const averageOptimisedCO2e = co2e(averageOptimisedSize)

  // Total CO2e saved per video
  const deltaCO2e = originalCO2e - averageOptimisedCO2e

  return {
    originalSize: manifest.size,
    originalCO2e,
    averageOptimisedCO2e,
    averageOptimisedSize,
    deltaCO2e
  }
}

export const total = <O extends Record<string, unknown>>(arr: O[], key: keyof O) =>
  arr.reduce((acc, curr) => acc + (isNumber(curr[key]) ? curr[key] : 0), 0)

export const average = <O extends Record<string, unknown>>(arr: O[], key: keyof O) =>
  total(arr, key) / arr.length

export const createCO2eReport = (videos: { status: 'success'; manifest: VideoManifest }[]) => {
  const reports = videos.map(({ manifest }) => getVideoCO2eReport(manifest))

  // Total original file size across all media
  const originalSize = total(reports, 'originalSize')

  // Total optimised file size across all media
  const optimisedSize = total(reports, 'averageOptimisedSize')

  // Total bytes saved across all media
  const deltaSize = originalSize - optimisedSize

  // Total CO2e saved across all media
  const deltaCO2e = co2e(deltaSize)

  return {
    reports,
    originalSize,
    optimisedSize,
    deltaSize,
    deltaCO2e
  }
}

export const formatBytes = (bytes: number) => {
  const units = ['b', 'kb', 'mb', 'gb']
  let unitIndex = 0
  let value = bytes
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024
    unitIndex++
  }
  return `${value.toFixed(0)}${units[unitIndex]}`
}

export const formatCO2e = (co2e: number) => {
  const units = ['gCO2e', 'kgCO2e', 'tCO2e']
  let unitIndex = 0
  let value = co2e
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000
    unitIndex++
  }
  return `${value.toFixed(2)}${units[unitIndex]}`
}

export const logCO2eReport = (videos: VideoProcessingSuccessResult[]) => {
  const { deltaSize, deltaCO2e } = createCO2eReport(videos)
  const calculation = 12 * 1000 * deltaCO2e

  print.log({
    message: [
      `Saved ${formatBytes(deltaSize)} of data, or an estimated ${formatCO2e(deltaCO2e)} in emissions`
    ],
    color: 'lime green',
    indent: 0
  })
  print.log({
    message: [
      `For an example website with 1000 visitors per month`,
      `this could save ${formatCO2e(calculation)}/yr`
    ],
    color: 'lime green',
    indent: 0
  })
}
