[![CI](https://github.com/figureland/media-tools/actions/workflows/ci.yml/badge.svg)](https://github.com/figureland/media-tools/actions/workflows/ci.yml)
[![NPM](https://img.shields.io/npm/v/@figureland/media-tools?color=40bd5c)](https://img.shields.io/npm/v/@figureland/media-tools?color=40bd5c)

`media-tools` is a small tool for working with video files on the web. In particular it provides a simple workflow for managing video in [Astro](https://astro.build/) projects.

## Background

This tool were born out of frustration with the baffling complexity of managing videos on the web. Third-party video platforms like [Mux](https://mux.com/) or [Cloudinary](https://cloudinary.com/) are great, but they feel like overkill for a lot of smaller projects, and introduce another service, another login and another place where payment details need to be left.

This library is still quite complicated, so there is still a way to go to make it as user friendly as possible, but the core structure is minimal – essentially a much nicer experience of what you can do with `ffmpeg` and bash scripts.

## Getting started

This project depends on [bun](https://bun.sh/) and [ffmpeg](https://www.ffmpeg.org/). It's intended for local use, not for CI or servers although that may change with a more mature version in the future.

### 1. Install the dependency

```bash
bun add @figureland/media-tools
```

### 2. Run the script

You can now run the media tools CLI to ingest videos and output optimised versions. `--src` is the source folder for one or more videos. `--output` is the target folder where you want your optimised videos to live.

```json
"process-video": "media-process-video --src videos --output public"
```

For each video, it will be optimised and output into two versions (`.webm` and `.mp4`) alongside a poster thumbnail, and a `.json` manifest file. The manifest bundles links to the generated video assets.

### 3. Access the videos

Your processed videos are now available through an API. You query this using an `id` which is the original filename of your video, so if your original file is called `my-movie.mov` then the ID is `my-movie`.

```ts
const manifest = await getVideoManifest('public', 'my-movie')
```

### 4. Usage in astro

The library provides an Astro collection Zod schema which transforms the `string` ID into a `VideoManifest` if the API can find it. This works similarly to how Astro's built-in `image()` helper works.

```ts
import { video } from '@figureland/media-tools/astro'

const videoAssetsFolder = path.resolve(process.cwd(), 'public')

export const videoSchema = () =>
  z.object({
    type: z.enum(['video']),
    src: video(videoAssetsFolder),
    autoplay: z.boolean().default(true),
    loop: z.boolean().default(true),
    muted: z.boolean().default(true),
    caption: z.string().optional()
  })
```
