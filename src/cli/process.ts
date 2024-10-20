#!/usr/bin/env bun

import { processVideos } from '../video'
import { name } from '../../package.json'
import { parseArgs } from 'util'

const { values } = parseArgs({
  options: {
    src: { type: 'string' },
    output: { type: 'string' }
  },
  allowPositionals: true
})

if (!values.src) {
  console.error(`Usage: ${name} --src <input_directory> [--output <output_directory>]`)
  process.exit(1)
}

const input = values.src
const outputFolder = values.output || input

processVideos({ input, outputFolder })
  .then((videos) => {
    if (videos.success.length > 0) {
      console.log(`> Generated ${videos.success.length} videos`)
    }
    if (videos.unchanged.length > 0) {
      console.log(`> ${videos.unchanged.length} videos were unchanged`)
    }
    if (videos.errors.length > 0) {
      console.log(`> ${videos.errors.length} videos failed to process`)
    }
  })
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
