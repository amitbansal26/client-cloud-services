
/**
 * @file        - Entry file referencing Storage Service
 * @description - Entry file referencing Storage Service
 * @exports     - `AzureStorageService` and `AWSStorageService`
 * @since       - 5.0.3
 * @version     - 1.0.0
 */

const AzureStorageService = require('./AzureStorageService');
// const AWSStorageService   = require('./AWSStorageService');
// const GCPStorageService   = require('./GCPStorageService');


/**
 * Based on Environment Cloud Provider value
 * Export respective Storage Service
 */

export function init(serviceProvider) {
  switch (serviceProvider) {
    case 'azure':
      return AzureStorageService.AzureStorageService
      break;
    // case 'aws':
    //   exports.CLOUD_CLIENT = new AWSStorageService();
    //   break;
    // case 'gcloud':
    //   exports.CLOUD_CLIENT = new GCPStorageService();
    //   break;
    default:
      break;
  }
}
