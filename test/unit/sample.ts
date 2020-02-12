import test from 'tape'

test('sample test', (t) => {
  for (let i = 0; i < 10000; i ++) {
    t.equal(i, i)
  }
  t.end()
})
