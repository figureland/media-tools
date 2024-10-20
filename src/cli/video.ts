#!/usr/bin/env bun

import { readdir, mkdir, access, stat } from 'fs/promises'
import { join, extname } from 'path'
import { isFFmpegInstalled, processVideo } from '../ffmpeg'
import { name } from '../../package.json'

const main = async (input: string, outputFolder: string) => {
  try {
    await access(input)
  } catch (error) {
    console.error(`Error: The input "${input}" does not exist or is not accessible.`)
    process.exit(1)
  }

  const hasFFmpeg = await isFFmpegInstalled()

  if (!hasFFmpeg) {
    console.error('Error: ffmpeg is not installed.')
    process.exit(1)
  }

  await mkdir(outputFolder, { recursive: true })

  const inputStat = await stat(input)
  const isDirectory = inputStat.isDirectory()

  if (isDirectory) {
    // Process directory
    const targetFiles = await readdir(input)
    const videoFiles = targetFiles.filter((file) =>
      ['.mp4', '.mov'].includes(extname(file).toLowerCase())
    )

    if (videoFiles.length === 0) {
      console.log(
        `No video files found in "${input}". Please make sure the directory contains .mp4 or .mov files.`
      )
      process.exit(0)
    }

    for (const f of videoFiles) {
      const file = join(input, f)
      await processVideo({
        outputFolder,
        file,
        baseDir: '/converted/',
        overwrite: true,
        loglevel: 'info'
      })
    }

    console.log('All videos processed.')
  } else {
    // Process single file
    if (!['.mp4', '.mov'].includes(extname(input).toLowerCase())) {
      console.error(`Error: The file "${input}" is not a supported video format (.mp4 or .mov).`)
      process.exit(1)
    }

    await processVideo({
      outputFolder,
      file: input,
      baseDir: '/converted/',
      overwrite: true,
      loglevel: 'info'
    })

    console.log('Video processed.')
  }
}

if (import.meta.main) {
  const args = process.argv.slice(2)
  const srcIndex = args.indexOf('--src')
  const outputIndex = args.indexOf('--output')

  if (srcIndex === -1 || outputIndex === -1) {
    console.error(`Usage: ${name} --src <input_directory> --output <output_directory>`)
    process.exit(1)
  }

  const inputDir = args[srcIndex + 1]
  const outputDir = args[outputIndex + 1]

  if (!inputDir || !outputDir) {
    console.error('Both --src and --output arguments are required')
    process.exit(1)
  }

  main(inputDir, outputDir)
}
