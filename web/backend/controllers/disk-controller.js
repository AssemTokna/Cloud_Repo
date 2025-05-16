const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const { platform } = require("os");
const systemUtils = require("../utils/system-utils");

// Helper function to check if QEMU is available
function checkQemuAvailability() {
  try {
    if (platform() === "win32") {
      // On Windows, check both in PATH and common installation directories
      try {
        execSync("where qemu-img", { stdio: "ignore" });
        return { available: true };
      } catch {
        // Check common installation directories
        const commonPaths = [
          "C:\\Program Files\\qemu",
          "C:\\Program Files (x86)\\qemu",
          process.env.USERPROFILE + "\\qemu",
          "C:\\qemu",
        ];

        for (const qemuPath of commonPaths) {
          const imgPath = path.join(qemuPath, "qemu-img.exe");
          if (fs.existsSync(imgPath)) {
            return {
              available: true,
              path: imgPath,
            };
          }
        }

        return {
          available: false,
          message:
            "QEMU is not installed or not in your PATH. Please install QEMU and make sure it's in your system PATH.",
        };
      }
    } else {
      // On Linux/macOS
      try {
        execSync("which qemu-img", { stdio: "ignore" });
        return { available: true };
      } catch {
        return {
          available: false,
          message:
            "QEMU is not installed or not in your PATH. Please install QEMU with your package manager.",
        };
      }
    }
  } catch (error) {
    return {
      available: false,
      message: `Error checking QEMU: ${error.message}`,
    };
  }
}

// List all disks
exports.listDisks = (req, res, appDirs) => {
  try {
    const disks = fs
      .readdirSync(appDirs.disks)
      .filter((file) => file.endsWith(".qcow2") || file.endsWith(".raw"));

    res.json({
      success: true,
      disks: disks,
    });
  } catch (error) {
    console.error("Error listing disks:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Create a new disk
exports.createDisk = (req, res, appDirs) => {
  try {
    // First check if QEMU is available
    const qemuCheck = checkQemuAvailability();
    if (!qemuCheck.available) {
      return res.status(500).json({
        success: false,
        message: qemuCheck.message,
      });
    }

    const { type, size, name } = req.body;
    const sizeGB = parseInt(size);

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Please enter a disk name.",
      });
    }

    // Validate disk size against available space
    const diskSizeValidation = systemUtils.validateDiskSize(
      sizeGB,
      appDirs.disks
    );
    if (!diskSizeValidation.isValid) {
      return res.status(400).json({
        success: false,
        message: diskSizeValidation.message,
        availableSpaceGB: diskSizeValidation.availableSpaceGB,
      });
    }

    // Ensure disk name has correct extension
    let diskName = name;
    if (!diskName.endsWith(`.${type}`)) {
      diskName += `.${type}`;
    }

    const diskPath = path.join(appDirs.disks, diskName);

    // Check if disk already exists
    if (fs.existsSync(diskPath)) {
      return res.status(400).json({
        success: false,
        message: "Disk already exists.",
      });
    }

    // Create disk using qemu-img
    let command;
    if (qemuCheck.path) {
      // Use the full path if found in common directories
      command = `"${qemuCheck.path}" create -f ${type} "${diskPath}" ${sizeGB}G`;
    } else {
      // Use the command from PATH
      command = `qemu-img create -f ${type} "${diskPath}" ${sizeGB}G`;
    }

    console.log(`Executing command: ${command}`);
    execSync(command);

    res.json({
      success: true,
      diskName: diskName,
      message: `Disk '${diskName}' created successfully.`,
    });
  } catch (error) {
    console.error("Error creating disk:", error);
    res.status(500).json({
      success: false,
      message: error.message || "Unknown error creating disk",
    });
  }
};

// Delete a disk
exports.deleteDisk = (req, res, appDirs) => {
  try {
    const diskName = req.params.name;
    const diskPath = path.join(appDirs.disks, diskName);

    // Check if disk exists
    if (!fs.existsSync(diskPath)) {
      return res.status(404).json({
        success: false,
        message: "Disk not found.",
      });
    }

    // Delete the disk file
    fs.unlinkSync(diskPath);

    res.json({
      success: true,
      message: `Disk '${diskName}' deleted.`,
    });
  } catch (error) {
    console.error("Error deleting disk:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
