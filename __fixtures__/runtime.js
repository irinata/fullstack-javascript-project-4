export default function filterAnagrams(str, arr) {
  const makeUniqWord = word => String(word)
    .split('')
    .map(c => c.toLowerCase())
    .sort()
    .join('')

  return arr.filter(item => makeUniqWord(item)
    .localeCompare(makeUniqWord(str)) === 0)
}
