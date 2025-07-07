import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'
import * as cheerio from 'cheerio'
import { Listr } from 'listr2'
import debug from 'debug'
import { addLogger } from 'axios-debug-log'

addLogger(axios)
const log = debug('page-loader')

async function saveFile(filepath, data) {
  log(`Write file ${filepath}`)
  return fsp.writeFile(filepath, data)
    .then(() => { return filepath })
    .catch((error) => {
      log(`Failed to write file ${filepath}`)
      throw new Error(`File write error: ${error}`)
    })
}

async function downloadData(url, config = {}) {
  log(`Download data from ${url}, config: ${JSON.stringify(config, null, 2)}`)
  return axios.get(url, config)
    .then(response => response.data)
    .catch((error) => {
      log(`Failed to download data from ${url}`)
      throw new Error(`File download error: ${error}`)
    })
}

async function checkDirectoryExists(dirPath, strictMode = 1) {
  log(`Check if directory exists: ${dirPath}`)
  return fsp.stat(dirPath)
    .then((stats) => {
      if (!stats.isDirectory()) {
        log(`${dirPath} is not a directory`)
        throw new TypeError(`${dirPath} is not a directory`)
      }
      log(`${dirPath} exists`)
      return true
    })
    .catch((error) => {
      log(`${dirPath} does not exist`)
      if (strictMode) {
        throw new Error(`Directory ${dirPath} does not exist: ${error}`)
      }
      return false
    })
}

async function makeDirectory(dirPath) {
  return checkDirectoryExists(dirPath, 0)
    .then((exists) => {
      if (!exists) {
        log(`Create directory: ${dirPath}`)
        fsp.mkdir(dirPath)
      }
    })
    .catch((error) => {
      log(`Failed to create ${dirPath}`)
      throw new Error(`Failed to create dir ${dirPath}: ${error}`)
    })
}

function getName(str, postfix) {
  return str.replace(/^http[s]?:\/\//, '').replace(/[^a-z\d]/g, '-') + postfix
}

function modifyResourcesAttributes($, url, resourceDir) {
  const pageUrl = new URL(url)
  const resources = []
  $('link[href], script[src], img[src]').each((_, el) => {
    const tag = el.name
    const attr = tag === 'link' ? 'href' : 'src'
    const attrValue = $(el).attr(attr)
    if (!attrValue) return

    let ext = path.extname(attrValue)
    if (tag === 'img' && !ext) return

    // if src is relative or contains domain
    // ? construct resource url from domain
    // : construct resource url from domain/path
    const resourceUrl = attrValue.match(/^(?:\/|http)/)
      ? new URL(attrValue, pageUrl.origin)
      : new URL(path.join(pageUrl.pathname, attrValue), pageUrl.origin)

    if (resourceUrl.host !== pageUrl.host) return

    const preparedStr = ext ? resourceUrl.href.slice(0, -ext.length) : resourceUrl.href
    const resourceFilename = getName(preparedStr, ext || (tag === 'link' ? '.html' : ''))

    resources.push({ tag, url: resourceUrl, filename: resourceFilename })
    const newAttrValue = path.join(resourceDir, resourceFilename)

    log(`Modify resource attribute for '${tag}[${attr}]':`)
    log(`FROM: '${attrValue}' TO: '${newAttrValue}'`)

    $(el).attr(attr, newAttrValue)
  })
  return resources
}

async function downloadPageResources(url, dir, pageData) {
  const resourceDir = getName(url, '_files')
  const resourceFullPath = path.join(path.resolve(dir), resourceDir)
  log(`Resources directory will be: ${resourceFullPath}`)
  const $ = cheerio.load(pageData)

  return makeDirectory(resourceFullPath)
    .then(() => {
      log('Modify page resources attributes')
      return modifyResourcesAttributes($, url, resourceDir)
    })
    .then((resources) => {
      log(`Create tasks to download and save resources`)
      const tasks = resources.map(resource => ({
        title: resource.url.href,
        task: () => {
          const config = resource.tag === 'img'
            ? { responseType: 'arraybuffer' }
            : { responseType: 'text' }
          return downloadData(resource.url, config)
            .then((data) => {
              const resourceFilepath = path.join(resourceFullPath, resource.filename)
              return saveFile(resourceFilepath, data)
            })
            .catch((error) => {
              throw new Error(error.message)
            })
        },
      }))
      const listr = new Listr(tasks, { concurrent: true, exitOnError: false })
      return listr.run()
    })
    .then(() => {
      return $.html()
    })
    .catch(() => {
      return $.html()
    })
};

function savePage(url, dir, data) {
  log('Save main page')
  const filename = getName(url, '.html')
  const filepath = path.join(path.resolve(dir), filename)
  return saveFile(filepath, data)
}

function downloadPage(url) {
  log('Download main page')
  const pageUrl = new URL(url)
  return downloadData(pageUrl)
}

export default function loadPage(url, dir = process.cwd()) {
  return checkDirectoryExists(path.resolve(dir))
    .then(() => downloadPage(url))
    .then(data => downloadPageResources(url, dir, data))
    .then(newdata => savePage(url, dir, newdata))
}
