/**
 * Utility functions for Universal Backup System
 * Handles validation, checksums, and formatting
 */

/**
 * Generates a simple checksum hash for data integrity verification
 * Uses a fast non-cryptographic hash (DJB2 variant) for synchronous performance
 * @param {Object|string} data - Data to hash
 * @returns {string} Hexadecimal hash string
 */
export const generateBackupChecksum = (data) => {
  const str = typeof data === 'string' ? data : JSON.stringify(data);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  return (hash >>> 0).toString(16);
};

/**
 * Validates that the backup object has the required top-level structure
 * @param {Object} backupData 
 * @returns {Object} { isValid: boolean, missingKeys: string[] }
 */
export const validateBackupStructure = (backupData) => {
  if (!backupData || typeof backupData !== 'object') {
    return { isValid: false, missingKeys: ['ROOT_OBJECT'] };
  }

  const requiredKeys = [
    'metadata',
    'data',
    'checksum'
  ];

  const missingKeys = requiredKeys.filter(key => !(key in backupData));
  
  if (missingKeys.length > 0) {
    return { isValid: false, missingKeys };
  }

  // Validate metadata structure
  const requiredMetadata = ['id', 'versionApp', 'createdAt', 'totalRegistros'];
  const missingMetadata = requiredMetadata.filter(key => !(key in backupData.metadata));

  if (missingMetadata.length > 0) {
    return { isValid: false, missingKeys: missingMetadata.map(k => `metadata.${k}`) };
  }

  return { isValid: true, missingKeys: [] };
};

/**
 * Validates the data integrity by recalculating checksum
 * @param {Object} backupData 
 * @param {string} originalChecksum 
 * @returns {boolean}
 */
export const validateBackupIntegrity = (backupData, originalChecksum) => {
  // We exclude the checksum itself from the calculation
  const { checksum, ...dataToHash } = backupData;
  const calculated = generateBackupChecksum(dataToHash);
  return calculated === originalChecksum;
};

/**
 * Calculates the size of the backup object in bytes
 * @param {Object} backupData 
 * @returns {number} Size in bytes
 */
export const calculateBackupSize = (backupData) => {
  const str = JSON.stringify(backupData);
  return new Blob([str]).size;
};

/**
 * Formats bytes into human readable string
 * @param {number} bytes 
 * @returns {string} formatted string (e.g., "1.5 MB")
 */
export const formatBackupSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * Helper to download JSON data as file
 * @param {Object} data 
 * @param {string} filename 
 */
export const downloadBackupFile = (data, filename) => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};