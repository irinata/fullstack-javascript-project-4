import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'
import * as cheerio from 'cheerio'
import Listr from 'listr'

async function saveFile(filepath, data) {
  return fsp.writeFile(filepath, data)
    .then(() => { return filepath })
    .catch((error) => { throw new Error(`File write error: ${error}`) })
}

async function downloadData(url, config = {}) {
  return axios.get(url, config)
    .then(response => response.data)
    .catch((error) => { throw new Error(`File download error: ${error}`) })
}

async function checkDirectoryExists(dirPath, strictMode = 1) {
  return fsp.stat(dirPath)
    .then((stats) => {
      if (!stats.isDirectory()) {
        throw new TypeError(`${dirPath} is not a directory`)
      }
      return true
    })
    .catch((error) => {
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
        fsp.mkdir(dirPath)
          .catch((error) => { throw new Error(`Failed to create dir ${dirPath}: ${error}`) })
      }
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

    $(el).attr(attr, path.join(resourceDir, resourceFilename))
  })
  return resources
}

async function downloadPageResources(url, dir, pageData) {
  const resourceDir = getName(url, '_files')
  const resourceFullPath = path.join(path.resolve(dir), resourceDir)
  const $ = cheerio.load(pageData)

  return makeDirectory(resourceFullPath)
    .then(() => {
      return modifyResourcesAttributes($, url, resourceDir)
    })
    .then((resources) => {
      const tasks = resources.map(resource => ({
        title: resource.url.href,
        task: (ctx, task) => {
          const config = resource.tag === 'img'
            ? { responseType: 'arraybuffer' }
            : { responseType: 'text' }
          return downloadData(resource.url, config)
            .then((data) => {
              const resourceFilepath = path.join(resourceFullPath, resource.filename)
              return saveFile(resourceFilepath, data)
            })
            .catch((error) => {
              task.title = `Error: ${resource.url}`
              ctx.errors = ctx.errors || []
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
  const filename = getName(url, '.html')
  const filepath = path.join(path.resolve(dir), filename)
  return saveFile(filepath, data)
}

function downloadPage(url) {
  const pageUrl = new URL(url)
  return downloadData(pageUrl)
}

export default function loadPage(url, dir = process.cwd()) {
  return checkDirectoryExists(path.resolve(dir))
    .then(() => downloadPage(url))
    .then(data => downloadPageResources(url, dir, data))
    .then(newdata => savePage(url, dir, newdata))
}
