import axios from 'axios'
import fsp from 'fs/promises'
import path from 'path'

function checkDirectoryExists(dirPath) {
  return fsp.stat(dirPath)
    . then((stats) => {
      if (!stats.isDirectory()) {
        throw new TypeError(`${dirPath} is not a directory`)
      }
    })
    .catch((error) => { throw new Error(`Directory ${dirPath} does not exist: ${error}`) })
}

// function makeDirectory(dirPath) {
//   return checkDirectoryExists(dirPath).then((exists) => {
//     if (!exists) {
//       //console.log('Creating dir ' + dirPath);
//       return fsp.mkdir(dirPath, { recursive: true })
//       .then(() => { console.log('dir created'); /*return 'dir created res'*/ })
//       .catch((error) => { throw new Error(`Failed to create dir ${dirPath}: ${error}`) });
//     }});
// }

function downloadData(newUrl, filepath) {
  return axios.get(newUrl)
    .then((response) => {
      return fsp.writeFile(filepath, response.data)
        .catch((error) => { throw new Error(`File write error: ${error}`) })
    })
    .catch((error) => { throw new Error(`Error on data load: ${error}`) })
}

export default function loadPage(url, dir = process.cwd()) {
  const fullpath = path.resolve(dir)

  return checkDirectoryExists(fullpath).then(() => {
    const filename = url.replace(/^http[s]?:\/\//, '').replace(/[^a-z\d]/g, '-') + '.html'
    const filepath = path.join(fullpath, filename)
    const newUrl = new URL(url)

    return downloadData(newUrl, filepath)
      .then(() => { return filepath })
  })
}
