// @flow
import {Transform} from 'stream'

export default class QuoteRemover extends Transform {
  _transform (chunk: Buffer | string, encoding: string, callback:()=> void) {
    let regex = /([^,|^\n])"([^,|^\n])/g
    // Any quote with a non comma or newline on both sides.

    // Assume that a buffer contains a whole number of fields.
    this.push(Buffer.from(chunk.toString().replace(regex, "'")))
    callback()
  }
}
