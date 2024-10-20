import { readFile } from 'fs/promises'
import { createHash } from 'crypto'

export const getFileHash = async (inputFile: string) => {
  const inputHash = createHash('md5')
    .update(await readFile(inputFile))
    .digest('hex')
  const shortHash = inputHash.slice(0, 8)

  return {
    hash: inputHash,
    shortHash
  }
}
