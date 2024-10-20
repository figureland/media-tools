import { co2 } from '@tgwf/co2'
import type { VideoManifest } from './schema'
import type { VideoProcessingSuccessResult } from './video'
import { print } from './log'

export const getCO2eReport = (manifest: VideoManifest) => {
  const swd = new co2({ model: 'swd' })

  let totalSize = 0

  for (const source of manifest.sources) {
    totalSize += source.size
  }

  const averageSize = totalSize / manifest.sources.length

  const originalSize = manifest.size
  const originalCO2e = Number(swd.perByte(manifest.size))
  const averageOptimisedCO2e = Number(swd.perByte(averageSize))
  const averageOptimisedSize = totalSize / manifest.sources.length

  const deltaCO2e = originalCO2e - averageOptimisedCO2e

  return {
    originalSize,
    originalCO2e,
    averageOptimisedCO2e,
    averageOptimisedSize,
    deltaCO2e
  }
}

const acc = <O extends Record<string, number>>(arr: O[], key: keyof O) =>
  arr.reduce((acc, curr) => acc + curr[key], 0)

const average = <O extends Record<string, number>>(arr: O[], key: keyof O) =>
  acc(arr, key) / arr.length

export const createCO2eReport = (videos: { status: 'success'; manifest: VideoManifest }[]) => {
  const reports = videos.map(({ manifest }) => getCO2eReport(manifest))

  const originalCO2e = average(reports, 'originalCO2e')
  const optimisedCO2e = average(reports, 'deltaCO2e')
  const originalSize = average(reports, 'originalSize')
  const optimisedSize = average(reports, 'averageOptimisedSize')

  const deltaSize = originalSize - optimisedSize
  const deltaCO2e = originalCO2e - optimisedCO2e

  return {
    reports,
    originalSize,
    originalCO2e,
    optimisedCO2e,
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
      `this could save ${formatCO2e(12 * 1000 * deltaCO2e)}/yr`
    ],
    color: 'lime green',
    indent: 0
  })
}
