// @flow
import request from 'request'
import rp from 'request-promise-native'
import type {Config} from './config'

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
    getp: async function (endpoint: string) {
      return rp.get({ uri: `${j.instance_url}${endpoint}`, headers: { 'Authorization': `Bearer ${j.access_token}` } })
    }
  }
}
