import { fileURLToPath } from 'url'
import path from 'path'
import os from 'os'
import nock from 'nock'
import fsp from 'fs/promises'
import { crc32 } from 'easy-crc'
import loadPage from '../src/page-loader.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getFixturePath = filename => path.join(__dirname, '..', '__fixtures__', filename)

nock.disableNetConnect()

it('on non-existent directory should throw exception', async () => {
  const promise = loadPage('https://ru.hexlet.io/courses', '/tmp/nosuchdir')
  return expect(promise).rejects.toThrow()
})

describe('check download of page and its resources', () => {
  let initialPageData
  let expectedPageData
  let img1
  let img2
  let expectedImg1Checksum
  let expectedImg2Checksum
  let resourceDir = 'ru-hexlet-io-courses_files'

  beforeAll(async () => {
    initialPageData = await fsp.readFile(getFixturePath('index.html'), 'utf-8')
    expectedPageData = await fsp.readFile(getFixturePath('expected.html'), 'utf-8')
    img1 = await fsp.readFile(getFixturePath('nodejs.png'))
    img2 = await fsp.readFile(getFixturePath('nodejs2.png'))
    expectedImg1Checksum = crc32('CRC-32', img1)
    expectedImg2Checksum = crc32('CRC-32', img2)
  })

  test.each([['temp directory'], ['project directory'],
  ])('data load into %s should work', async (dir) => {
    const testDir = dir === 'temp directory'
      ? await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader'))
      : process.cwd()

    const expectedPagePath = path.join(testDir, 'ru-hexlet-io-courses.html')
    const expectedImg1Path = path.join(testDir, resourceDir, 'ru-hexlet-io-assets-professions-nodejs.png')
    const expectedImg2Path = path.join(testDir, resourceDir, 'ru-hexlet-io-courses-images-nodejs2.png')

    nock('https://ru.hexlet.io')
      .get('/courses')
      .reply(200, initialPageData)

    nock('https://ru.hexlet.io')
      .get('/assets/professions/nodejs.png')
      .reply(200, img1)

    nock('https://ru.hexlet.io')
      .get('/courses/images/nodejs2.png')
      .reply(200, img2)

    const actualPagePath = dir === 'temp directory'
      ? await loadPage('https://ru.hexlet.io/courses', testDir)
      : await loadPage('https://ru.hexlet.io/courses')

    const actualPageData = await fsp.readFile(actualPagePath, 'utf-8')

    expect(actualPagePath).toBe(expectedPagePath)
    expect(actualPageData).toBe(expectedPageData)

    const actualImg1 = await fsp.readFile(expectedImg1Path)
    const actualImg2 = await fsp.readFile(expectedImg2Path)
    const actualImg1Checksum = crc32('CRC-32', actualImg1)
    const actualImg2Checksum = crc32('CRC-32', actualImg2)

    expect(actualImg1Checksum).toBe(expectedImg1Checksum)
    expect(actualImg2Checksum).toBe(expectedImg2Checksum)
  })
})
