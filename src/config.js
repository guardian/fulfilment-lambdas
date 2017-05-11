import AWS from 'aws-sdk'

let s3 = new AWS.S3()

export function fetchConfig() {
    return new Promise((resolve, reject) => {
        let stage = process.env.Stage;
        if (stage != 'CODE' && stage != 'PROD') {
            reject(`invalid stage: ${stage}, please fix Stage env variable`);
            return;
        }
        const key = 'zuora.private.json';
        const bucket = `subscriptions-private/${stage}`;
        console.log(`loading ${stage} configuration from ${bucket}/${key}`);

        s3.getObject(
            { Bucket: bucket, Key: key },
            function (err, data) {
                if (err)
                    reject(err);
                else {
                    const json = JSON.parse(new Buffer(data.Body));
                    resolve(json.DEV.zuora.api);
                }
            });
    })
}