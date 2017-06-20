import {fetchConfig} from './config'
import request from 'request'
import moment from 'moment'


export function handler (input, context, callback) {
  let res = {
    'statusCode': '200',
    'headers': {
      'Content-Type': 'application/json'
    },
    'body': 'nothing here yet'
  }

  callback(null, res)
}
