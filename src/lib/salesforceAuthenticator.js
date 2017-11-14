// @flow
import request from 'request'
import rp from 'request-promise-native'
import type {Config} from './config'
import NamedError from './NamedError'

export type folder = {
  folderId: string,
  name: string
}

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
  return new Salesforce(j.instance_url, j.access_token)
}

export class Salesforce {
  url: string
  headers: Object
  constructor (url: string, token: string) {
    this.url = url
    this.headers = { 'Authorization': `Bearer ${token}` }
  }
  getStream (endpoint: string) {
    return request.get({ uri: `${this.url}${endpoint}`, headers: this.headers })
  }
  get (endpoint: string) {
    return rp.get({ uri: `${this.url}${endpoint}`, headers: this.headers })
  }
  post (endpoint: string, form: mixed) {
    return rp.post({
      uri: `${this.url}${endpoint}`,
      headers: this.headers,
      formData: form
    })
  }
  async uploadDocument (path: string, folder: folder, description: string,  body: Buffer) {
     // build a little json
    let message = {
      'Description': description,
      'Keywords': 'fulfilment',
      'FolderId': folder.folderId,
      'Name': path,
      'Type': 'csv'
    }
    console.log('Building SF upload.')

    let url = '/services/data/v23.0/sobjects/Document/' // NOT FOR UPDATING

  // don't try to make the form with a stream from s3 or by appending form sections
    let form = {
      entity_document: {
        value: JSON.stringify(message),
        options: {
          contentType: 'application/json'
        }
      },
      Body: { value: body, options: { contentType: 'text/csv', filename: path } }
    }

    let uploadResult = await this.post(url, form)
    let parsed = JSON.parse(uploadResult)

    if (parsed.id == null) {
      throw new NamedError('Upload failed', 'Upload did not return an id')
    }
    let id = parsed.id
    return {
      id: id,
      url: `${this.url}/${id}`
    }
  }
  async getDocuments (folderId: folder) {
    let response = await this.get(`/services/data/v20.0/query?q=SELECT Id, Name FROM Document WHERE FolderId= '${folderId.folderId}'`)
    if (response == null) {
      throw new Error(`Failed to parse salesforce attempt when listing folder ${folderId.name} (${folderId.folderId}) contents.`)
    }
    let j = JSON.parse(response)
    console.log(j)
    if (j == null || j.records == null) {
      throw new Error('No records received from Salesforce')
    }
    return j.records // Todo: make this return an [document]
  }
}
