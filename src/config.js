import AWS from 'aws-sdk'
import NamedError from './NamedError'
let s3 = new AWS.S3()

export function fetchConfig () {
  return new Promise((resolve, reject) => {
    let stage = process.env.Stage
    if (stage !== 'CODE' && stage !== 'PROD') {
      reject(new Error(`invalid stage: ${stage}, please fix Stage env variable`))
      return
    }
    const key = 'fulfilment.private.json'
    const bucket = `fulfilment-private/${stage}`
    console.log(`loading ${stage} configuration from ${bucket}/${key}`)

    s3.getObject(
            { Bucket: bucket, Key: key },
            function (err, data) {
              if (err) { reject(new NamedError('s3_download_error', `Error fetching config for S3 : ${err}`)) } else {
                let json = JSON.parse(Buffer.from(data.Body))
                resolve({
                  stage: stage,
                  ...json
                })
              }
            })
  })
}
