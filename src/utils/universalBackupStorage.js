/**
 * LocalStorage management for Universal Backups
 * Handles CRUD operations against the "universalBackups" key
 */

const STORAGE_KEY = 'universalBackups';

/**
 * Saves a new backup to the list in LocalStorage
 * @param {Object} backup - The complete backup object
 * @returns {Object} Result { success: boolean, message: string }
 */
export const saveBackupToLocalStorage = (backup) => {
  try {
    const current = getBackupsFromLocalStorage();
    
    // Check for duplicates by ID
    if (current.some(b => b.metadata.id === backup.metadata.id)) {
      return { success: false, message: 'Backup with this ID already exists.' };
    }

    const updated = [backup, ...current];
    
    // Try to save
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return { success: true, message: 'Backup saved successfully.' };
    } catch (e) {
      if (e.name === 'QuotaExceededError') {
        return { success: false, message: 'Storage quota exceeded. Please delete old backups or export to file.' };
      }
      throw e;
    }
  } catch (error) {
    console.error('Save Backup Error:', error);
    return { success: false, message: error.message };
  }
};

/**
 * Retrieves all backups from LocalStorage
 * @returns {Array} List of backups
 */
export const getBackupsFromLocalStorage = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (error) {
    console.error('Get Backups Error:', error);
    return [];
  }
};

/**
 * Retrieves a single backup by ID
 * @param {string} backupId 
 * @returns {Object|null}
 */
export const getBackupFromLocalStorage = (backupId) => {
  const backups = getBackupsFromLocalStorage();
  return backups.find(b => b.metadata.id === backupId) || null;
};

/**
 * Deletes a backup from LocalStorage
 * @param {string} backupId 
 * @returns {Object} Result
 */
export const deleteBackupFromLocalStorage = (backupId) => {
  try {
    const current = getBackupsFromLocalStorage();
    const updated = current.filter(b => b.metadata.id !== backupId);
    
    if (current.length === updated.length) {
      return { success: false, message: 'Backup not found.' };
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    return { success: true, message: 'Backup deleted successfully.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/**
 * Clears ALL backups
 * @returns {Object} Result
 */
export const clearAllBackups = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return { success: true, message: 'All backups cleared.' };
  } catch (error) {
    return { success: false, message: error.message };
  }
};

/**
 * estimates current usage
 * @returns {Object} { usedBytes: number, formatted: string }
 */
export const getStorageUsage = () => {
  const raw = localStorage.getItem(STORAGE_KEY) || '';
  const bytes = new Blob([raw]).size;
  return {
    usedBytes: bytes,
    formatted: (bytes / 1024 / 1024).toFixed(2) + ' MB'
  };
};