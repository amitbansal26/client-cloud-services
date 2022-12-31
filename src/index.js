
/**
 * @file        - Entry file referencing Storage Service
 * @description - Entry file referencing Storage Service
 * @exports     - `AzureStorageService`, `AWSStorageService` and 'GCPStorageService`
 * @author      - RAJESH KUMARAVEL
 * @since       - 5.0.3
 * @version     - 1.0.0
 */

const AzureStorageService = require('./AzureStorageService');
const AWSStorageService   = require('./AWSStorageService');
const GCPStorageService   = require('./GCPStorageService');
const OCIStorageService   = require('./OCIStorageService');


/**
 * Based on Environment Cloud Provider value
 * Export respective Storage Service
 */

export function init(provider) {
  switch (provider) {
    case 'azure':
      return AzureStorageService.AzureStorageService
      break;
    case 'aws':
      return AWSStorageService.AWSStorageService
      break;
    case 'gcloud':
      return GCPStorageService.GCPStorageService
      break;
    case 'oci':
      return OCIStorageService.OCIStorageService
      break;
    default:
      throw new Error(`Client Cloud Service - ${provider} provider is not supported`);
  }
}
