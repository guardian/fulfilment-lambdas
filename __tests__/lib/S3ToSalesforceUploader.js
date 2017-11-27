/* eslint-env jest */
import * as sfUpload from '../../src/lib/S3ToSalesforceUploader'

function getTestInput (id: string) {
  return {
    destination: {
      fileName: `sfFilename_${id}`,
      sfDescription: `sfDescription_${id}`,
      sfFolder: {
        folderId: `sfFolderId_${id}`,
        name: `sfFolderName${id}`
      }
    },
    source: {
      bucket: 'fulfilment-bucket-name',
      prefix: `source_path/file_${id}`
    }
  }
}

let mockSalesForce = {
  uploadDocument: jest.fn(() => Promise.resolve({id: 'documentId'}))
}

jest.mock('../../src/lib/config')
jest.mock('../../src/lib/storage')

beforeEach(() => {
  mockSalesForce.uploadDocument.mock.calls = []
})

test('should upload files', done => {
  let mockedStorage = require('../../src/lib/storage')
  mockedStorage.getObject = jest.fn().mockImplementation(path => {
    return Promise.resolve({
      file: {
        Body: 'something'
      }
    })
  })

  let testInput = [getTestInput(1), getTestInput(2), getTestInput(3)]

  sfUpload.uploadFiles(testInput, mockSalesForce).then(res => {
    try {
      // downloads from s3
      expect(mockedStorage.getObject.mock.calls.length).toBe(3)
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_1')
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_2')
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_3')

      // uploads to sf
      expect(mockSalesForce.uploadDocument.mock.calls.length).toBe(3)

      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('sfFilename_1', {folderId: 'sfFolderId_1', name: 'sfFolderName1'}, 'sfDescription_1', undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('sfFilename_2', {folderId: 'sfFolderId_2', name: 'sfFolderName2'}, 'sfDescription_2', undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('sfFilename_3', {folderId: 'sfFolderId_3', name: 'sfFolderName3'}, 'sfDescription_3', undefined)

      let expectedResponse = [
        {id: 'documentId', name: 'sfFilename_1'},
        {id: 'documentId', name: 'sfFilename_2'},
        {id: 'documentId', name: 'sfFilename_3'}
      ]

      expect(res).toEqual(expectedResponse)
      done()
    } catch (e) {
      done.fail(e)
    }
  })
})

test('should ignore missing files', done => {
  let mockedStorage = require('../../src/lib/storage')
  mockedStorage.getObject = jest.fn().mockImplementation(path => {
    if (path !== 'source_path/file_2') {
      return Promise.resolve({
        file: {
          Body: 'something'
        }
      })
    }
    return Promise.reject(new Error('file not found'))
  })
  let testInput = [getTestInput(1), getTestInput(2), getTestInput(3)]
  sfUpload.uploadFiles(testInput, mockSalesForce).then(res => {
    try {
      // downloads from s3
      expect(mockedStorage.getObject.mock.calls.length).toBe(3)
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_1')
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_2')
      expect(mockedStorage.getObject).toHaveBeenCalledWith('source_path/file_3')

      // uploads to sf
      expect(mockSalesForce.uploadDocument.mock.calls.length).toBe(2)

      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('sfFilename_1', {folderId: 'sfFolderId_1', name: 'sfFolderName1'}, 'sfDescription_1', undefined)
      expect(mockSalesForce.uploadDocument).toHaveBeenCalledWith('sfFilename_3', {folderId: 'sfFolderId_3', name: 'sfFolderName3'}, 'sfDescription_3', undefined)

      let expectedResponse = [
        {id: 'documentId', name: 'sfFilename_1'},
        {id: 'documentId', name: 'sfFilename_3'}
      ]

      expect(res).toEqual(expectedResponse)
      done()
    } catch (e) {
      done.fail(e)
    }
  })
})