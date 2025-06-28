import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'

function saveFile(filepath, data) {
  return fsp.writeFile(filepath, data)
    .then(() => { return filepath })
    .catch((error) => { throw new Error(`File write error: ${error}`) })
}

function downloadData(newUrl) {
  return axios.get(newUrl) 
    .then((response) => { return response.data })
    .catch((error) => { throw new Error(`Error on data load: ${error}`) })
  }

function checkDirectoryExists(dirPath) {
  return fsp.stat(dirPath)
    . then((stats) => {
      if (!stats.isDirectory()) {
        throw new TypeError(`${dirPath} is not a directory`)
      }
    })
    .catch((error) => { throw new Error(`Directory ${dirPath} does not exist: ${error}`) })
}

export default function loadPage(url, dir = process.cwd()) {
  const fullpath = path.resolve(dir)  

  return checkDirectoryExists(fullpath)
    .then(() => {
      const mainUrl = new URL(url);
      return downloadData(mainUrl);
    })    
    .then((data) => {
      const filename = url.replace(/^http[s]?:\/\//, '').replace(/[^a-z\d]/g, '-') + '.html'
      const filepath = path.join(fullpath, filename)
      return saveFile(filepath, data);
    })    
}
