import test from 'tape'

// A wrapper around tape's `test` function that allows it to be used like
// await test('it works', async t => ...)
export default async function (str: string, cb: Function) {
  return new Promise((resolve, reject) => {
    try {
      test(str, async t => {
        await cb(t)
        resolve()
      })
    } catch (e) {
      reject(e)
    }
  })
}
