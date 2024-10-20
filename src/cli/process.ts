#!/usr/bin/env bun

import { isSuccessfulResult, processVideos } from '../video'
import { name } from '../../package.json'
import { parseArgs } from 'util'
import { print } from '../log'
import { logCO2eReport } from '../sustainability'

const { values } = parseArgs({
  options: {
    src: { type: 'string' },
    output: { type: 'string' },
    baseDir: { type: 'string' }
  },
  allowPositionals: true
})

if (!values.src || !values.output) {
  print.error({
    message: [
      `Usage: ${name} --src <input_directory> [--output <output_directory>] [--baseDir <base_directory>]`
    ]
  })
  process.exit(1)
}

const input = values.src
const outputFolder = values.output
const baseDir = values.baseDir

processVideos({ input, outputFolder, baseDir, loglevel: 'quiet' })
  .then(async (videos) => {
    if (videos.success.length > 0) {
      print.log({
        message: [`> Generated ${videos.success.length} videos`],
        color: 'lime green'
      })
      print.log({
        message: videos.success
          .filter(isSuccessfulResult)
          .map((video) => `> ${video.manifest?.id}`),
        indent: 2
      })

      logCO2eReport(videos.success)
    }
    if (videos.unchanged.length > 0) {
      print.log({
        message: [`> ${videos.unchanged.length} videos were unchanged`],
        color: 'orange'
      })
    }
    if (videos.errors.length > 0) {
      print.log({
        message: [`> ${videos.errors.length} videos failed to process`],
        color: 'orange'
      })
    }
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
