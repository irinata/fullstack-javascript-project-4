import path from 'path'
import os from 'os'
import nock from 'nock'
import fsp from 'fs/promises'
import loadPage from '../index.js'

nock.disableNetConnect()

let tempDir
beforeEach(async () => {
  tempDir = await fsp.mkdtemp(path.join(os.tmpdir(), 'page-loader'))
})

it('on non-existent directory should throw exception', async () => {
  tempDir = '/tmp/nonExistingDir'
  const promise = loadPage('https://ru.hexlet.io/courses', tempDir)
  return expect(promise).rejects.toThrow()
})

it('data load into provided temp dir should work', async () => {
  const data = 'some data'
  const expectedFilepath = path.join(tempDir, 'ru-hexlet-io-courses.html')
  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, data)

  const filepath = await loadPage('https://ru.hexlet.io/courses', tempDir)
  const content = await fsp.readFile(filepath, 'utf-8')

  expect(filepath).toBe(expectedFilepath)
  expect(content).toBe(data)
})

it('data load into default project dir should work', async () => {
  const data = 'some data'
  const expectedFilepath = path.join(process.cwd(), 'ru-hexlet-io-courses.html')
  nock('https://ru.hexlet.io')
    .get('/courses')
    .reply(200, data)

  const filepath = await loadPage('https://ru.hexlet.io/courses')
  const content = await fsp.readFile(filepath, 'utf-8')

  expect(filepath).toBe(expectedFilepath)
  expect(content).toBe(data)
})
