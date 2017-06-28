import {formatPostCode} from './../src/lib/formatters'
import test from 'ava'

test('postcode', t => {
  let postcodes = [
    {in: 'n19gu', out: 'N1 9GU'},
    {in: 'n1 9gu', out: 'N1 9GU'}, // gu postcodes
    {in: 'AA9A 9AA', out: 'AA9A 9AA'}, // valid formats from https://en.wikipedia.org/wiki/Postcodes_in_the_United_Kingdom
    {in: 'A9 9AA', out: 'A9 9AA'},
    {in: 'AA99 9AA', out: 'AA99 9AA'},
    {in: 'A99 9AA', out: 'A99 9AA'},
    {in: 'A9A 9AA', out: 'A9A 9AA'},
    {in: 'AA9A9AA', out: 'AA9A 9AA'}]
  t.plan(postcodes.length)
  postcodes.map(p => {
    t.true(formatPostCode(p.in) === p.out)
  })
})
