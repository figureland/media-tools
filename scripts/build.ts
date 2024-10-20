import dts from 'bun-plugin-dts'

await Bun.build({
  entrypoints: ['./src/cli/process.ts'],
  outdir: './dist',
  target: 'bun',
  format: 'esm',
  plugins: [dts()]
})
