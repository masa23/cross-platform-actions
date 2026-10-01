import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'

import {createSparseDisk, parseDiskSize} from '../src/extra_disk'

describe('extra disk size', () => {
  for (const [value, expected] of [
    ['512', 512],
    ['1K', 1024],
    ['2m', 2 * 1024 ** 2],
    ['100G', 100 * 1024 ** 3],
    ['1T', 1024 ** 4]
  ] as const) {
    it(`parses ${value} as bytes`, () => {
      expect(parseDiskSize(value)).toEqual(expected)
    })
  }

  for (const value of [
    '',
    '0',
    '0G',
    '-1G',
    '1.5G',
    '1GB',
    '1GiB',
    '1 G',
    '513',
    '1e3',
    'Infinity',
    '9007199254740992',
    '8192T',
    '1G,format=qcow2',
    '1G; touch /tmp/unwanted',
    '10G\n20G'
  ]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(() => parseDiskSize(value)).toThrowError(/Invalid extra_disk_size/)
    })
  }
})

describe('sparse disk creation', () => {
  let directory: string
  let file: string

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cpa-extra-test-'))
    file = path.join(directory, 'disk.raw')
  })

  afterEach(() => fs.rmSync(directory, {recursive: true, force: true}))

  it('creates a zero-filled 100 GiB disk without allocating its capacity', () => {
    const size = parseDiskSize('100G')
    createSparseDisk(file, size)
    const stat = fs.statSync(file)
    expect(stat.size).toEqual(size)
    expect(stat.blocks * 512).toBeLessThan(1024 * 1024)

    const descriptor = fs.openSync(file, 'r')
    try {
      const buffer = Buffer.alloc(512, 255)
      fs.readSync(descriptor, buffer, 0, buffer.length, size - buffer.length)
      expect(buffer).toEqual(Buffer.alloc(512))
    } finally {
      fs.closeSync(descriptor)
    }
  })

  it('refuses to overwrite a disk that already contains data', () => {
    fs.writeFileSync(file, 'existing data')
    expect(() => createSparseDisk(file, 1024)).toThrow()
    expect(fs.readFileSync(file, 'utf8')).toEqual('existing data')
  })
})
