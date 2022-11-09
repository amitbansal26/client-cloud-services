/**
 * @file        - Azure Storage Service
 * @exports     - `AzureStorageService`
 * @since       - 5.0.1
 * @version     - 1.0.0
 * @implements  - BaseStorageService
 */

const BaseStorageService  = require('./BaseStorageService');
const azure               = require('azure-storage');
const { logger }          = require('@project-sunbird/logger');
const async               = require('async');
const _                   = require('lodash');
const dateFormat          = require('dateformat');
const uuidv1              = require('uuid/v1');
const multiparty          = require('multiparty');

export class AzureStorageService extends BaseStorageService {

  constructor(config) {
    super();
    if (!_.get(config, 'sunbird_azure_account_name') ||
    !_.get(config, 'sunbird_azure_account_key') ||
    !_.get(config, 'sunbird_azure_report_container_name')
    ) {
      throw new Error('AzureStorageService :: Required configuration is missing')
    }
    this.sunbird_azure_report_container_name = _.get(config, 'sunbird_azure_report_container_name')
    this.blobService = azure.createBlobService(config?.sunbird_azure_account_name, config?.sunbird_azure_account_key);
  }

  fileExists(container, fileToGet, callback) {
    if (!container || !fileToGet || !callback) throw new Error('Invalid arguments');
    logger.info({ msg: 'Azure__StorageService - fileExists called for container ' + container + ' for file ' + fileToGet });
    this.blobService.doesBlobExist(container, fileToGet, (err, response) => {
      if (err) {
        callback(err);
      } else {
        callback(null, response)
      }
    });
  }
  /**
   * @description                                                     - Retrieves a shared access signature token
   * @param  { string } container                                     - Container name
   * @param  { string } blob                                          - Blob to be fetched
   * @param  { azure.common.SharedAccessPolicy } sharedAccessPolicy   - Shared access policy
   * @param  { azure.common.ContentSettingsHeaders } headers          - Optional header values to set for a blob returned wth this SAS
   * @return { string }                                               - The shared access signature
   */
  generateSharedAccessSignature(container, blob, sharedAccessPolicy, headers) {
    return this.blobService.generateSharedAccessSignature(container, blob, sharedAccessPolicy, headers);
  }

  /**
   * @description                                                    - Retrieves a blob or container URL
   * @param  { string } container                                    - Container name
   * @param  { string } blob                                         - Blob to be fetched
   * @param  { string } SASToken                                     - Shared Access Signature token
   * @return { string }                                              - Formatted URL string
   */
  getUrl(container, blob, SASToken) {
    return this.blobService.getUrl(container, blob, SASToken)
  }

  fileReadStream(container = undefined, fileToGet = undefined) {
    return (req, res, next) => {
      let container = this.sunbird_azure_report_container_name;
      let fileToGet = req.params.slug.replace('__', '\/') + '/' + req.params.filename;
      logger.info({ msg: 'Azure__StorageService - fileReadStream called for container ' + container + ' for file ' + fileToGet });
      if (fileToGet.includes('.json')) {
        const readStream = this.blobService.createReadStream(container, fileToGet);
        readStream.pipe(res);
        readStream.on('end', () => {
          res.end();
        })
        readStream.on('error', error => {
          if (error && error.statusCode === 404) {
            logger.error({ msg: 'Azure__StorageService : readStream error - Error with status code 404', error: error });
            const response = {
              responseCode: "CLIENT_ERROR",
              params: {
                err: "CLIENT_ERROR",
                status: "failed",
                errmsg: "Blob not found"
              },
              result: {}
            }
            res.status(404).send(this.apiResponse(response));
          } else {
            logger.error({ msg: 'Azure__StorageService : readStream error - Error 500', error: error });
            const response = {
              responseCode: "SERVER_ERROR",
              params: {
                err: "SERVER_ERROR",
                status: "failed",
                errmsg: "Failed to display blob"
              },
              result: {}
            }
            res.status(500).send(this.apiResponse(response));
          }
        })
      } else {
        let startDate = new Date();
        let expiryDate = new Date(startDate);
        expiryDate.setMinutes(startDate.getMinutes() + 3600);
        startDate.setMinutes(startDate.getMinutes() - 3600);
        let sharedAccessPolicy = {
          AccessPolicy: {
            Permissions: azure.BlobUtilities.SharedAccessPermissions.READ,
            Start: startDate,
            Expiry: expiryDate
          }
        };
        this.fileExists(container, fileToGet, (err, resp) => {
          if (err || !(_.get(resp, 'exists'))) {
            logger.error({ msg: 'Azure__StorageService : doesBlobExist error - Error with status code 404', error: err });
            const response = {
              responseCode: "CLIENT_ERROR",
              params: {
                err: "CLIENT_ERROR",
                status: "failed",
                errmsg: "Blob not found"
              },
              result: {}
            }
            res.status(404).send(this.apiResponse(response));
          } else {
            let azureHeaders = {};
            if (req.headers['content-disposition'] == 'attachment' && req.headers.filename) azureHeaders.contentDisposition = `attachment;filename=${req.headers.filename}`;
            let token = this.generateSharedAccessSignature(container, fileToGet, sharedAccessPolicy, azureHeaders);
            let sasUrl = this.getUrl(container, fileToGet, token);
            const response = {
              responseCode: "OK",
              params: {
                err: null,
                status: "success",
                errmsg: null
              },
              result: {
                'signedUrl': sasUrl
              }
            }
            res.status(200).send(this.apiResponse(response));
          }
        })

      }
    }
  }

  async getBlobProperties(request, callback) {
    this.blobService.getBlobProperties(request.container, request.file, function (err, result, response) {
      if (err) {
        logger.error({ msg: 'Azure__StorageService : readStream error - Error with status code 404' });
        callback({ msg: err.message, statusCode: err.statusCode, filename: request.file, reportname: request.reportname });
      }
      else if (!response.isSuccessful) {
        console.error("Blob %s wasn't found container %s", file, request.container)
        callback({ msg: err.message, statusCode: err.statusCode, filename: request.file, reportname: request.reportname });
      }
      else {
        result.reportname = request.reportname;
        result.statusCode = 200;
        callback(null, result);
      }
    });
  }

  getFileProperties(container = undefined, fileToGet = undefined) {
    return (req, res, next) => {
      const container = this.sunbird_azure_report_container_name;
      const fileToGet = JSON.parse(req.query.fileNames);
      logger.info({ msg: 'Azure__StorageService - getFileProperties called for container ' + container + ' for file ' + fileToGet });
      const responseData = {};
      if (Object.keys(fileToGet).length > 0) {
        const getBlogRequest = [];
        for (const [key, file] of Object.entries(fileToGet)) {
          const req = {
            container: container,
            file: file,
            reportname: key
          }
          getBlogRequest.push(
            async.reflect((callback) => {
              this.getBlobProperties(req, callback)
            })
          );
        }
        async.parallel(getBlogRequest, (err, results) => {
          if (results) {
            results.forEach(blob => {
              if (blob.error) {
                responseData[(_.get(blob, 'error.reportname'))] = blob.error
              } else {
                responseData[(_.get(blob, 'value.reportname'))] = {
                  lastModified: _.get(blob, 'value.lastModified'),
                  reportname: _.get(blob, 'value.reportname'),
                  statusCode: _.get(blob, 'value.statusCode'),
                  fileSize: _.get(blob, 'value.contentLength')
                }
              }
            });
            const finalResponse = {
              responseCode: "OK",
              params: {
                err: null,
                status: "success",
                errmsg: null
              },
              result: responseData
            }
            res.status(200).send(this.apiResponse(finalResponse))
          }
        });
      }
    }
  }

  getFileAsText(container = undefined, fileToGet = undefined, callback) {
    this.blobService.getBlobToText(container, fileToGet, (error, result, response) => {
      if (error) {
        logger.error({ msg: 'Azure__StorageService : getFileAsText error => ', error });
        callback(error);
      } else if (result) {
        logger.info({ msg: 'Azure__StorageService : getFileAsText success for container ' + container + ' for file ' + fileToGet });
        callback(null, result);
      } else if (response) {
        callback(null, null, response)
        logger.info({
          msg: 'Azure__StorageService : getFileAsText success response for container ' +
            container + ' for file ' + fileToGet + ' response ' + response
        });
      }
    });
  }

  blockStreamUpload(uploadContainer = undefined) {
    return (req, res) => {
      try {
        const blobFolderName = new Date().toLocaleDateString();
        let form = new multiparty.Form();
        form.on('part', (part) => {
          if (part.filename) {
            var size = part.byteCount;
            var name = `${_.get(req, 'query.deviceId')}_${Date.now()}.${_.get(part, 'filename')}`;
            logger.info({
              msg: 'Azure__StorageService : blockStreamUpload Uploading file to container ' +
                uploadContainer + ' to folder ' + blobFolderName +
                ' for file name ' + name + ' with size ' + size
            });
            this.blobService.createBlockBlobFromStream(uploadContainer, `${blobFolderName}/${name}`, part, size, (error) => {
              if (error && error.statusCode === 403) {
                const response = {
                  responseCode: "FORBIDDEN",
                  params: {
                    err: "FORBIDDEN",
                    status: "failed",
                    errmsg: "Unable to authorize to azure blob"
                  },
                  result: req.file
                }
                logger.error({
                  msg: 'Azure__StorageService : blockStreamUpload Unable to authorize to azure blob for uploading desktop crash logs',
                  error: error
                });
                return res.status(403).send(this.apiResponse(response, 'api.desktop.upload.crash.log'));
              } else if (error) {
                const response = {
                  responseCode: "SERVER_ERROR",
                  params: {
                    err: "SERVER_ERROR",
                    status: "failed",
                    errmsg: "Failed to upload to blob"
                  },
                  result: {}
                }
                logger.error({
                  msg: 'Azure__StorageService : blockStreamUpload Failed to upload desktop crash logs to blob',
                  error: error
                });
                return res.status(500).send(this.apiResponse(response, 'api.desktop.upload.crash.log'));
              } else {
                const response = {
                  responseCode: "OK",
                  params: {
                    err: null,
                    status: "success",
                    errmsg: null
                  },
                  result: {
                    'message': 'Successfully uploaded to blob'
                  }
                }
                return res.status(200).send(this.apiResponse(response, 'api.desktop.upload.crash.log'));
              }
            });
          }
        });
        form.parse(req);
      } catch (error) {
        const response = {
          responseCode: "SERVER_ERROR",
          params: {
            err: "SERVER_ERROR",
            status: "failed",
            errmsg: "Failed to upload to blob"
          },
          result: {}
        }
        logger.error({
          msg: 'Azure__StorageService : blockStreamUpload Failed to upload desktop crash logs to blob',
          error: error
        });
        return res.status(500).send(this.apiResponse(response, 'api.desktop.upload.crash.log'));
      }
    }
  }

  apiResponse({ responseCode, result, params: { err, errmsg, status } }, id = 'api.report') {
    return {
      'id': id,
      'ver': '1.0',
      'ts': dateFormat(new Date(), 'yyyy-mm-dd HH:MM:ss:lo'),
      'params': {
        'resmsgid': uuidv1(),
        'msgid': null,
        'status': status,
        'err': err,
        'errmsg': errmsg
      },
      'responseCode': responseCode,
      'result': result
    }
  }

  upload(container, fileName, filePath, options = {}, callback) {
    this.blobService.createBlockBlobFromLocalFile(container, fileName, filePath, options, (error, result, response) => {
      if (error) {
        logger.error({ msg: 'Azure__StorageService : upload error => ', error });
        callback(error);
      } else if (result) {
        logger.info({ msg: 'Azure__StorageService : upload success for container ' + container + ' for file ' + fileName });
        callback(null, result);
      } else if (response) {
        callback(null, null, response)
        logger.info({
          msg: 'Azure__StorageService : upload success response for container ' +
            container + ' for file ' + filename + ' response ' + response
        });
      }
    });
  }
}
