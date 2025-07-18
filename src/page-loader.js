import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'
import * as cheerio from 'cheerio'
import { Listr } from 'listr2'
import debug from 'debug'
import { addLogger } from 'axios-debug-log'

addLogger(axios)
const log = debug('page-loader')

async function saveFile(filepath, data, bom = false) {
  log(`Write file ${filepath}`)
  const bomBytes = Buffer.from([0xef, 0xbb, 0xbf])
  const buffer = Buffer.concat([bomBytes, Buffer.from(data, 'utf-8')])
  const buffer2 = bom ? buffer : data
  return fsp.writeFile(filepath, buffer2)
    .then(() => { return filepath })
    .catch((error) => {
      log(`Failed to write file ${filepath}: ${error.message}`)
      throw error
    })
}

async function downloadData(url, config = {}) {
  log(`Download data from ${url}, config: ${JSON.stringify(config, null, 2)}`)
  return axios.get(url, config)
    .then(response => response.data)
    .catch((error) => {
      log(`Failed to download data from ${url}: ${error.message}`)
      throw error
    })
}

async function checkDirectoryExists(dirPath, strictMode = 1) {
  log(`Check if directory exists: ${dirPath}`)
  return fsp.stat(dirPath)
    .then((stats) => {
      if (!stats.isDirectory()) {
        log(`${dirPath} is not a directory`)
        throw new TypeError(`TypeError: ${dirPath} exists and is not a directory`)
      }
      log(`${dirPath} exists`)
      return true
    })
    .catch((error) => {
      if (!error.code) throw error
      log(`${dirPath} does not exist`)
      if (strictMode) throw error
      return false
    })
}

async function checkDirectoryPermissions(dirPath) {
  log(`Check permissions`)
  return fsp.access(dirPath, fsp.constants.W_OK | fsp.constants.X_OK)
    .catch((error) => {
      log(`No execution or write permissions for ${dirPath}`)
      throw error
    })
}

async function makeDirectory(dirPath) {
  return checkDirectoryExists(dirPath, 0)
    .then((exists) => {
      if (!exists) {
        log(`Create directory: ${dirPath}`)
        return fsp.mkdir(dirPath)
      }
    })
    .catch((error) => {
      log(`Failed to create ${dirPath}: ${error.message}`)
      throw error
    })
}

function getName(str, postfix) {
  return str.replace(/^https?:\/\//, '').replace(/[^a-z\d]/g, '-') + postfix
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
  const resourceFullPath = path.join(dir, resourceDir)
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
        task: (ctx, task) => {
          const config = resource.tag === 'img'
            ? { responseType: 'arraybuffer' }
            : { responseType: 'text' }
          return downloadData(resource.url, config)
            .then((data) => {
              const resourceFilepath = path.join(resourceFullPath, resource.filename)
              const bom = path.extname(resource.filename) === '.css'
              return saveFile(resourceFilepath, data, bom)
            })
            .catch((error) => {
              const errStatus = error?.response?.status
              const errText = error?.response?.statusText
              const errMsg = `${resource.url} ` + (errStatus && errText ? `(${errStatus} ${errText})` : `(${error.code})`)
              task.title = errMsg
              throw errMsg
            })
        },
      }))
      const listr = new Listr(tasks, { concurrent: true, exitOnError: false })
      return listr.run()
    })
    .then(() => {
      return $.html()
    })
};

function savePage(url, dir, data) {
  log('Save main page')
  const filepath = path.join(dir, getName(url, '.html'))
  return saveFile(filepath, data)
}

function downloadPage(url) {
  log('Download main page')
  const pageUrl = new URL(url)
  return downloadData(pageUrl)
}

export default function (url, dir = process.cwd()) {
  const fullpath = path.resolve(dir)
  return checkDirectoryExists(fullpath)
    .then(() => checkDirectoryPermissions(fullpath))
    .then(() => downloadPage(url))
    .then(data => downloadPageResources(url, fullpath, data))
    .then(newdata => savePage(url, fullpath, newdata))
}
