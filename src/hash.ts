import { readFile } from 'fs/promises'
import { createHash } from 'crypto'

export const getFileHash = async (inputFile: string) => {
  const fileContent = await readFile(inputFile)
  const inputHash = createHash('md5').update(new Uint8Array(fileContent)).digest('hex')
  const shortHash = inputHash.slice(0, 8)

  return {
    hash: inputHash,
    shortHash
  }
}
