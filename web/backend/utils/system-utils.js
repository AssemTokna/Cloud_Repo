const os = require("os");
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

/**
 * Utilities for checking system specifications and validating resource requests
 */
const systemUtils = {
  /**
   * Get the number of CPU cores available on the system
   * @returns {number} Number of CPU cores
   */
  getAvailableCPUCores: () => {
    return os.cpus().length;
  },

  /**
   * Get total system memory in MB
   * @returns {number} Available memory in MB
   */
  getAvailableMemoryMB: () => {
    const totalMemoryBytes = os.totalmem();
    const totalMemoryMB = Math.floor(totalMemoryBytes / (1024 * 1024));
    return totalMemoryMB;
  },

  /**
   * Get available disk space in GB for a specific path
   * @param {string} diskPath - Path to check available space
   * @returns {number} Available disk space in GB
   */
  getAvailableDiskSpaceGB: (diskPath) => {
    try {
      // For Windows
      if (os.platform() === "win32") {
        const drive = path.parse(diskPath).root;
        const output = execSync(
          `powershell -Command "(Get-PSDrive ${drive[0]}).Free"`,
          { encoding: "utf8" }
        );
        const freeSpaceBytes = parseInt(output.trim());
        return Math.floor(freeSpaceBytes / (1024 * 1024 * 1024));
      }
      // For Linux/macOS
      else {
        const output = execSync(`df -B1 "${diskPath}" | tail -1`, {
          encoding: "utf8",
        });
        const available = output.trim().split(/\s+/)[3];
        return Math.floor(parseInt(available) / (1024 * 1024 * 1024));
      }
    } catch (error) {
      console.error("Error getting available disk space:", error);
      // Return a conservative estimate as fallback
      return 10;
    }
  },

  /**
   * Validate CPU cores request
   * @param {number} requestedCores - Number of CPU cores requested
   * @returns {Object} Validation result with isValid flag and message
   */
  validateCPUCores: (requestedCores) => {
    const availableCores = systemUtils.getAvailableCPUCores();

    // Keep at least 1 core for the host system
    const maxAllowableCores = Math.max(1, availableCores - 1);
    const isValid = requestedCores > 0 && requestedCores <= maxAllowableCores;

    return {
      isValid,
      availableCores: maxAllowableCores,
      message: isValid
        ? `CPU cores valid (${requestedCores} of ${maxAllowableCores} available)`
        : `Requested cores (${requestedCores}) must be between 1 and ${maxAllowableCores}`,
    };
  },

  /**
   * Validate memory request
   * @param {number} requestedMemoryMB - Requested memory in MB
   * @returns {Object} Validation result with isValid flag and message
   */
  validateMemory: (requestedMemoryMB) => {
    const availableMemoryMB = systemUtils.getAvailableMemoryMB();

    // Reserve at least 2GB for the host system
    const reserveMB = 2 * 1024;
    const maxAllowableMemoryMB = Math.max(512, availableMemoryMB - reserveMB);
    const isValid =
      requestedMemoryMB > 0 && requestedMemoryMB <= maxAllowableMemoryMB;

    return {
      isValid,
      availableMemoryMB: maxAllowableMemoryMB,
      message: isValid
        ? `Memory allocation valid (${requestedMemoryMB}MB of ${maxAllowableMemoryMB}MB available)`
        : `Requested memory (${requestedMemoryMB}MB) must be between 512MB and ${maxAllowableMemoryMB}MB`,
    };
  },

  /**
   * Validate disk size request
   * @param {number} requestedSizeGB - Requested disk size in GB
   * @param {string} diskStoragePath - Path where disk will be stored
   * @returns {Object} Validation result with isValid flag and message
   */
  validateDiskSize: (requestedSizeGB, diskStoragePath) => {
    const availableSpaceGB =
      systemUtils.getAvailableDiskSpaceGB(diskStoragePath);

    // Keep some buffer space (5GB or 10% of available space, whichever is larger)
    const bufferGB = Math.max(5, Math.floor(availableSpaceGB * 0.1));
    const maxAllowableSizeGB = Math.max(1, availableSpaceGB - bufferGB);
    const isValid =
      requestedSizeGB > 0 && requestedSizeGB <= maxAllowableSizeGB;

    return {
      isValid,
      availableSpaceGB: maxAllowableSizeGB,
      message: isValid
        ? `Disk size valid (${requestedSizeGB}GB of ${maxAllowableSizeGB}GB available)`
        : `Requested disk size (${requestedSizeGB}GB) must be between 1GB and ${maxAllowableSizeGB}GB`,
    };
  },

  /**
   * Validate if the file is a valid ISO file
   * @param {string} filePath - Path to the file
   * @returns {Object} Validation result with isValid flag and message
   */
  validateISOFile: (filePath) => {
    if (!filePath) {
      return {
        isValid: false,
        message: "No file selected",
      };
    }

    const isISOFile = filePath.toLowerCase().endsWith(".iso");
    const fileExists = fs.existsSync(filePath);

    if (!isISOFile) {
      return {
        isValid: false,
        message: "File must be an ISO image (.iso extension)",
      };
    }

    if (!fileExists) {
      return {
        isValid: false,
        message: `ISO file not found: ${filePath}`,
      };
    }

    return {
      isValid: true,
      message: "Valid ISO file",
    };
  },
};

module.exports = systemUtils;
