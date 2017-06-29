// @flow
import request from 'request'
import rp from 'request-promise-native'
import type {Config} from './config'
import NamedError from './NamedError'

export async function authenticate (config: Config) {
  console.log('Authenticating with Salesforce.')

  let url = `https://${config.salesforce.api.salesforceUrl}/services/oauth2/token`
  let auth = {
    'grant_type': 'password',
    'client_id': config.salesforce.api.consumer_key,
    'client_secret': config.salesforce.api.consumer_secret,
    'username': config.salesforce.api.username,
    'password': `${config.salesforce.api.password}${config.salesforce.api.token}`
  }
  let result = await rp.post(url, { form: auth })
  let j = JSON.parse(result)
  return {
    get: function (endpoint: string) {
      return request.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
    },
    post: function (endpoint: string, form: any) {
      return new Promise((resolve, reject) => {
        request.post({
          uri: `${j.instance_url}${endpoint}`,
          headers: {
            'Authorization': `Bearer ${j.access_token}`
          },
          formData: form
        }, function (err, httpResponse, body) {
          if (err != null) {
            console.error(err)
            reject(err)
          } else {
            resolve(body)
          }
        })
      })
    },
    url: j.instance_url,
    auth: `Bearer ${j.access_token}`,
    getp: async function (endpoint: string) {
      return rp.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
    },
    getFolderId: async function (name: string) {
      let endpoint = `/services/data/v20.0/query?q=SELECT Id, Name FROM Folder WHERE Name= '${name}'`
      let folderQuery = await rp.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
      let folderResult = JSON.parse(folderQuery)
      if (folderResult.totalSize !== 1) {
        console.log('Could not find fulfilment folder', folderResult)
        throw new NamedError('Could not find folder', 'Could not find folder')
      }
      return folderResult.records[0].Id
    }
  }
}
