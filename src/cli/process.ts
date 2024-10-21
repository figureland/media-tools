#!/usr/bin/env bun

import { isSuccessfulResult, processVideos } from '../video/generate'
import { name } from '../../package.json'
import { parseArgs } from 'util'
import { logo, print } from '../log'
import { logCO2eReport } from '../sustainability'
import { access, mkdir } from 'fs/promises'
import { basename } from 'path'
import { fileExists, getFilesInDirectory, isDirectory } from '../fs'
import { isFFmpegInstalled } from '../video/ffmpeg'

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
const baseDir = values.baseDir || values.output

const FILE_TYPES = ['.mp4', '.mov']

const main = async () => {
  try {
    print.log({
      message: logo.split('\n'),
      color: 'lime green'
    })

    await access(input)

    const isDir = await isDirectory(input)
    let files: string[] = []

    if (isDir) {
      files = await getFilesInDirectory(input, FILE_TYPES)
    } else {
      const existingFile = await fileExists(input, basename(input), FILE_TYPES)
      if (existingFile) {
        files.push(existingFile)
      } else {
        print.error({
          message: [`Error: The file "${input}" is not a supported video format (.mp4 or .mov).`]
        })
        process.exit(1)
      }
    }

    const hasFFmpeg = await isFFmpegInstalled()

    if (!hasFFmpeg) {
      print.error({ message: ['Error: ffmpeg is not installed.'] })
      process.exit(1)
    }

    await mkdir(outputFolder, { recursive: true })

    const videos = await processVideos({
      files,
      outputFolder,
      baseDir,
      loglevel: 'quiet'
    })

    print.space()

    if (videos.success.length > 0) {
      print.log({
        message: [`⬤ ${videos.success.length} videos optimised`, ''],
        color: 'lime green'
      })
      print.log({
        message: videos.success.filter(isSuccessfulResult).map((video) => `∟ ${video.manifest?.id}`)
      })
    }
    if (videos.unchanged.length > 0) {
      print.log({
        message: [`⬤ ${videos.unchanged.length} existing videos unchanged`, ''],
        color: 'orange'
      })
    }
    if (videos.errors.length > 0) {
      print.log({
        message: [`⬤ ${videos.errors.length} videos failed to process`, ''],
        color: 'orange'
      })
    }
    if (videos.success.length > 0) {
      logCO2eReport(videos.success)
    }
  } catch (error) {
    print.error({
      message: [`Error`]
    })

    console.error(error)
    process.exit(1)
  }
}

if (import.meta.main) {
  main()
}
