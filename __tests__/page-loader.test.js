import { fileURLToPath } from 'url'
import path from 'path'
import os from 'os'
import nock from 'nock'
import fsp from 'fs/promises'
import fs from 'fs'
import { crc32 } from 'easy-crc'
import loadPage from '../src/page-loader.js'
import debug from 'debug'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const getFixturePath = filename => path.join(__dirname, '..', '__fixtures__', filename)

const mockUrl = 'https://ru.hexlet.io/courses'
const resourceDir = 'ru-hexlet-io-courses_files'
const expectedPageName = 'ru-hexlet-io-courses.html'
const expectedImg1Name = 'ru-hexlet-io-assets-professions-nodejs.png'
const expectedImg2Name = 'ru-hexlet-io-courses-images-nodejs2.png'
const expectedCssFileName = 'ru-hexlet-io-assets-application.css'
const expectedHtmlFileName = 'ru-hexlet-io-courses.html'
const expectedScriptFileName = 'ru-hexlet-io-packs-js-runtime.js'
const resourceFilenames = [expectedImg1Name, expectedImg2Name,
  expectedCssFileName, expectedHtmlFileName, expectedScriptFileName]

nock.disableNetConnect()

test('on non-existent directory should throw', async () => {
  const noSuchDir = path.join(os.tmpdir(), 'nosuchdir123')
  const promise = loadPage(mockUrl, noSuchDir)
  await expect(promise).rejects.toThrow('ENOENT')

  // expect resource dir is not created
  const promise2 = fsp.stat(path.join(noSuchDir, resourceDir))
  expect(promise2).rejects.toThrow('ENOENT')

  // expect page file is not created
  const promise3 = fsp.stat(path.join(noSuchDir, expectedPageName))
  expect(promise3).rejects.toThrow('ENOENT')
})

test('no permissions to write into provided directory should throw', async () => {
  const tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader'))
  await fsp.chmod(tempDir, 0o555)
  const promise = loadPage(mockUrl, tempDir)
  await expect(promise).rejects.toThrow('EACCES')
})

test('provided file instead of directory should throw', async () => {
  const testFile = path.join(os.tmpdir(), 'testfile')
  await fsp.writeFile(testFile, '')
  const promise = loadPage(mockUrl, testFile)
  await expect(promise).rejects.toThrow('TypeError')
})

describe('check download of page and its resources', () => {
  let initialPageData
  let expectedPageData
  let expectedCssFile
  let expectedScriptFile
  let expectedImg1Checksum
  let expectedImg2Checksum
  let img1
  let img2
  let tempDir

  beforeAll(async () => {
    initialPageData = await fsp.readFile(getFixturePath('index.html'), 'utf-8')
    expectedPageData = await fsp.readFile(getFixturePath('expected.html'), 'utf-8')
    expectedCssFile = await fsp.readFile(getFixturePath('application.css'), 'utf-8')
    expectedScriptFile = await fsp.readFile(getFixturePath('runtime.js'), 'utf-8')
    img1 = await fsp.readFile(getFixturePath('nodejs.png'))
    img2 = await fsp.readFile(getFixturePath('nodejs2.png'))
    expectedImg1Checksum = crc32('CRC-32', img1)
    expectedImg2Checksum = crc32('CRC-32', img2)
  })

  beforeEach(async () => {
    nock('https://ru.hexlet.io')
      .get('/courses')
      .times(2)
      .reply(200, initialPageData)
      .get('/assets/professions/nodejs.png')
      .reply(200, img1)
      .get('/courses/images/nodejs2.png')
      .reply(200, img2)
      .get('/assets/application.css')
      .reply(200, expectedCssFile)
      .get('/packs/js/runtime.js')
      .reply(200, expectedScriptFile)

    tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader'))
  })

  afterEach(() => {
    nock.cleanAll()
  })

  test('download page and resources into provided directory', async () => {
    const actualPagePathname = await loadPage(mockUrl, tempDir)

    // expect correct page location and name
    expect(actualPagePathname).toBe(path.join(tempDir, expectedPageName))

    // expect correct page content
    const actualPageData = await fsp.readFile(actualPagePathname, 'utf-8')
    expect(actualPageData).toBe(expectedPageData)

    // expect resource directory exists
    const resDirStats = await fsp.stat(path.join(tempDir, resourceDir))
    expect(resDirStats.isDirectory()).toBe(true)

    // expect correct resources content
    const actualImg1 = await fsp.readFile(path.join(tempDir, resourceDir, expectedImg1Name))
    const actualImg2 = await fsp.readFile(path.join(tempDir, resourceDir, expectedImg2Name))
    const actualImg1Checksum = crc32('CRC-32', actualImg1)
    const actualImg2Checksum = crc32('CRC-32', actualImg2)
    const actualCssFile = await fsp.readFile(path.join(tempDir, resourceDir, expectedCssFileName), 'utf-8')
    const actualHtmlFile = await fsp.readFile(path.join(tempDir, resourceDir, expectedHtmlFileName), 'utf-8')
    const actualScriptFile = await fsp.readFile(path.join(tempDir, resourceDir, expectedScriptFileName), 'utf-8')

    expect(actualImg1Checksum).toBe(expectedImg1Checksum)
    expect(actualImg2Checksum).toBe(expectedImg2Checksum)
    expect(actualCssFile).toStrictEqual(expectedCssFile)
    expect(actualHtmlFile).toBe(initialPageData)
    expect(actualScriptFile).toBe(expectedScriptFile)
  })

  test('download page and resources into project directory', async () => {
    const actualPagePathname = await loadPage(mockUrl)
    const projectDir = process.cwd()

    // expect correct page location and name
    expect(actualPagePathname).toBe(path.join(projectDir, expectedPageName))

    // expect correct page content
    const actualPageData = await fsp.readFile(actualPagePathname, 'utf-8')
    expect(actualPageData).toBe(expectedPageData)

    // expect resource directory exists
    const resDirStats = await fsp.stat(path.join(projectDir, resourceDir))
    expect(resDirStats.isDirectory()).toBe(true)

    // expect resource files exist
    const promises = resourceFilenames.map((filename) => {
      return fsp.stat(path.join(projectDir, resourceDir, filename))
    })
    const results = await Promise.all(promises)
    results.forEach(stats => expect(stats.isFile()).toBe(true))
  })

  test('check debug log is created', async () => {
    debug.enable('page-loader')
    const logFile = path.join(tempDir, 'debug.log')
    const logStream = fs.createWriteStream(logFile, { flags: 'a' })

    debug.log = (...args) => {
      logStream.write(args.join(' ') + '\n')
    }
    await loadPage(mockUrl, tempDir)

    // expect log file exists
    const debugLogStats = await fsp.stat(logFile)
    expect(debugLogStats.isFile()).toBe(true)
    // expect log file is not empty
    expect(debugLogStats.size).toBeGreaterThan(0)

    debug.disable()
  })
})
