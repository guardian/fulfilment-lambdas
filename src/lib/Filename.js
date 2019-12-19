// @flow
import moment from 'moment'

const OUTPUT_DATE_FORMAT = 'YYYY-MM-DD'
// const MATCHERS = [
//   { format: 'YYYY-MM-DD', regex: /(\d\d\d\d[-_]\d\d[-_]\d\d)/ },
//   { format: 'DD-MM-YYYY', regex: /(\d\d[-_]\d\d[-_]\d\d\d\d)/ }
// ]

export class Filename {
  date: moment
  filename: string
  constructor (date: moment, filename: string) {
    this.date = date
    this.filename = filename
  }

  asLogFile () {
    const splitName = this.filename.split('.')
    splitName[1] = 'log'
    return splitName.join('.')
  }

  formatDate () {
    return this.date.format(OUTPUT_DATE_FORMAT)
  }
}

export function generateFilename (date: moment, product: string, maybeCountry: ?string, maybeFileType: ?string) {
  const fileType = maybeFileType || 'csv'
  const parts = [date.format(OUTPUT_DATE_FORMAT), product, maybeCountry].filter(i => i).join('_')
  return new Filename(date, `${parts}.${fileType}`)
}

// export function extractFilename (filename: string):?Filename {
//   const result = MATCHERS
//     .map(m => ({ ...m, match: new RegExp(m.regex).exec(filename) }))
//     .filter(m => m.match).map(m => moment(m.match[0], m.format))
//   const date = result[0] || null
//   return date ? new Filename(date, filename) : null
// }
