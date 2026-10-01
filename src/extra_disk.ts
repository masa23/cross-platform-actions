import * as fs from 'fs'

export function parseDiskSize(value: string): number {
  const match = /^([0-9]+)([KMGT]?)$/i.exec(value)
  const powers: Record<string, number> = {K: 1, M: 2, G: 3, T: 4}
  const size = match
    ? Number(match[1]) * 1024 ** (powers[match[2].toUpperCase()] ?? 0)
    : NaN

  if (!Number.isSafeInteger(size) || size <= 0 || size % 512 !== 0) {
    throw Error(
      `Invalid extra_disk_size: ${value}. Use a positive whole number of ` +
        'bytes (a multiple of 512), optionally followed by K, M, G or T, ' +
        'for example 100G.'
    )
  }

  return size
}

export function createSparseDisk(file: fs.PathLike, size: number): void {
  // Exclusive creation prevents a repeated invocation from erasing data.
  const descriptor = fs.openSync(file, 'wx', 0o600)
  try {
    fs.ftruncateSync(descriptor, size)
  } finally {
    fs.closeSync(descriptor)
  }
}
