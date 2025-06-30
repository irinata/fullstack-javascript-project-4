import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'
import * as cheerio from 'cheerio'

async function saveFile(filepath, data) {
  return fsp.writeFile(filepath, data)
    .then(() => { return filepath })
    .catch((error) => { throw new Error(`File write error: ${error}`) })
}

async function downloadData(url, config = {}) {
  return axios.get(url, config)
    .then(response => response.data)
    .catch((error) => { throw new Error(`Error on data load by ${url}: ${error}`) })
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

function modifyAttributes($, selector, attribute, pageUrl, resDir, resData) {
  $(selector).each((_, element) => {
    const imgSrc = $(element).attr(attribute)
    const ext = path.extname(imgSrc)
    if (!imgSrc || !ext) return

    const resUrl = imgSrc.match(/^(?:\/|http)/) // if src is relative or contains domain
      ? new URL(imgSrc, pageUrl.origin) // construct resource url from domain
      : new URL(path.join(pageUrl.pathname, imgSrc), pageUrl.origin) // construct resource url from domain/path

    if (resUrl.host !== pageUrl.host) return

    const resFilename = getName(resUrl.href.slice(0, resUrl.href.length - ext.length), ext || '.html')
    resData.push([resUrl, resFilename])

    const resourceHtmlPath = path.join(resDir, resFilename)
    $(element).attr('src', resourceHtmlPath)
  })
}

async function downloadPageResources(url, dir, pageData) {
  const resDir = getName(url, '_files')
  const resFullPath = path.join(path.resolve(dir), resDir)
  const $ = cheerio.load(pageData)
  const resData = []

  return makeDirectory(resFullPath)
    .then(() => {
      const pageUrl = new URL(url)
      const selector = 'img'
      const attribute = 'src'
      modifyAttributes($, selector, attribute, pageUrl, resDir, resData)

      const config = { responseType: 'arraybuffer' }
      return resData.map(([resUrl, _]) => downloadData(resUrl, config))
    })
    .then(requests => Promise.allSettled(requests))
    .then((results) => {
      const resFilepaths = resData.map(([_, resFilename]) => path.join(resFullPath, resFilename))
      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          saveFile(resFilepaths[index], result.value)
        }
      })
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
