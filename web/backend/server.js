const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const diskController = require("./controllers/disk-controller");
const vmController = require("./controllers/vm-controller");
const dockerController = require("./controllers/docker-controller");
const { execSync } = require("child_process");
const { platform } = require("os");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, "../frontend")));

// Set up multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const isoDir = path.join(__dirname, "../../iso");
    // Create directory if it doesn't exist
    if (!fs.existsSync(isoDir)) {
      fs.mkdirSync(isoDir, { recursive: true });
    }
    cb(null, isoDir);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

// File filter for ISO files
const fileFilter = (req, file, cb) => {
  // Accept only files with .iso extension
  if (file.originalname.toLowerCase().endsWith(".iso")) {
    cb(null, true);
  } else {
    cb(new Error("Only ISO files are allowed"), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Application folders
const appDirs = {
  disks: path.join(__dirname, "../../disks"),
  vms: path.join(__dirname, "../../vm_configs"),
  iso: path.join(__dirname, "../../iso"),
};

// Create folders if they don't exist
Object.values(appDirs).forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Routes
// Disk management
app.get("/api/disks", (req, res) =>
  diskController.listDisks(req, res, appDirs)
);
app.post("/api/disks", (req, res) =>
  diskController.createDisk(req, res, appDirs)
);
app.delete("/api/disks/:name", (req, res) =>
  diskController.deleteDisk(req, res, appDirs)
);

// VM management
app.get("/api/vms", (req, res) => vmController.listRunningVMs(req, res));
app.post("/api/vms", (req, res) => vmController.createVM(req, res, appDirs));
app.post("/api/vms/stop", (req, res) => vmController.stopVM(req, res));
app.post("/api/vms/start", (req, res) =>
  vmController.startVM(req, res, appDirs)
);
app.get("/api/vms/details", (req, res) =>
  vmController.getVMDetails(req, res, appDirs)
);

// VM Configuration
app.get("/api/vms/configs", (req, res) =>
  vmController.listVMConfigs(req, res, appDirs)
);
app.get("/api/vms/config/:name", (req, res) =>
  vmController.getVMConfig(req, res, appDirs)
);
app.post("/api/vms/config", (req, res) =>
  vmController.saveVMConfig(req, res, appDirs)
);
app.delete("/api/vms/config/:name", (req, res) =>
  vmController.deleteVMConfig(req, res, appDirs)
);

// ISO upload
app.post("/api/upload-iso", (req, res) => {
  upload.single("isoFile")(req, res, function (err) {
    // Handle multer errors
    if (err) {
      if (err.message === "Only ISO files are allowed") {
        return res.status(400).json({
          success: false,
          message: "Only ISO files (.iso extension) are allowed",
        });
      }

      return res.status(500).json({
        success: false,
        message: `File upload error: ${err.message}`,
      });
    }

    // Check if a file was uploaded
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Double-check file extension for security
    if (!req.file.originalname.toLowerCase().endsWith(".iso")) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (error) {
        console.error("Error deleting invalid file:", error);
      }

      return res.status(400).json({
        success: false,
        message:
          "Invalid file format. Please upload an ISO file (.iso extension)",
      });
    }

    res.json({
      success: true,
      path: req.file.path,
    });
  });
});

// Docker management
app.post("/api/docker/dockerfile", (req, res) =>
  dockerController.createDockerfile(req, res)
);
app.post("/api/docker/build", (req, res) =>
  dockerController.buildImage(req, res)
);
app.get("/api/docker/images", (req, res) =>
  dockerController.listImages(req, res)
);
app.post("/api/docker/containers/create", (req, res) =>
  dockerController.createContainer(req, res)
);
app.get("/api/docker/containers", (req, res) =>
  dockerController.listRunningContainers(req, res)
);
app.post("/api/docker/containers/stop", (req, res) =>
  dockerController.stopContainer(req, res)
);
app.post("/api/docker/images/search", (req, res) =>
  dockerController.searchLocalImage(req, res)
);
app.post("/api/docker/dockerhub/search", (req, res) => {
  console.log("DockerHub search requested for:", req.body.searchTerm);
  dockerController.searchDockerHub(req, res);
});
app.post("/api/docker/images/pull", (req, res) =>
  dockerController.pullImage(req, res)
);
app.post("/api/docker/images/delete", (req, res) =>
  dockerController.deleteImage(req, res)
);

// System specifications
app.get("/api/system/resources", (req, res) => {
  const systemUtils = require("./utils/system-utils");
  try {
    // Get available CPU cores
    const availableCores = systemUtils.getAvailableCPUCores();
    // Get available memory
    const availableMemoryMB = systemUtils.getAvailableMemoryMB();
    // Get available disk space for the disks directory
    const availableDiskSpaceGB = systemUtils.getAvailableDiskSpaceGB(
      appDirs.disks
    );

    // Calculate recommended maximums (keeping some resources for the host)
    const maxCores = Math.max(1, availableCores - 1);
    const reserveMemoryMB = 2 * 1024; // Reserve 2GB
    const maxMemoryMB = Math.max(512, availableMemoryMB - reserveMemoryMB);
    const bufferDiskGB = Math.max(5, Math.floor(availableDiskSpaceGB * 0.1));
    const maxDiskGB = Math.max(1, availableDiskSpaceGB - bufferDiskGB);

    res.json({
      success: true,
      resources: {
        cpu: {
          total: availableCores,
          recommended: maxCores,
        },
        memory: {
          totalMB: availableMemoryMB,
          recommendedMB: maxMemoryMB,
        },
        disk: {
          availableGB: availableDiskSpaceGB,
          recommendedMaxGB: maxDiskGB,
        },
      },
    });
  } catch (error) {
    console.error("Error getting system resources:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve system resource information",
    });
  }
});

// Serve the main HTML file
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/index.html"));
});

// Add a process watcher to ensure VM status accuracy
// This runs periodically to clean up stale VM references
function setupVMProcessWatcher() {
  const CHECK_INTERVAL = 5000; // Check every 5 seconds

  setInterval(() => {
    try {
      const runningPIDs = [];

      // Get list of actually running QEMU processes
      if (platform() === "win32") {
        const output = execSync(
          'tasklist /FI "IMAGENAME eq qemu-system-x86_64.exe" /FO CSV',
          { encoding: "utf8" }
        );
        const lines = output.split("\n");
        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(",");
            if (parts.length >= 2) {
              runningPIDs.push(parts[1].replace(/"/g, ""));
            }
          }
        }
      } else {
        const output = execSync(
          "ps -eo pid,command | grep qemu-system-x86_64 | grep -v grep",
          { encoding: "utf8" }
        );
        const lines = output.split("\n");
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line) {
            const parts = line.split(/\s+/);
            if (parts.length >= 2) {
              runningPIDs.push(parts[0]);
            }
          }
        }
      }

      // Clean up VM tracking
      for (const vmName in vmController.runningVMs) {
        const pid = vmController.runningVMs[vmName].pid;
        if (!runningPIDs.includes(String(pid))) {
          console.log(
            `Auto-cleaning stale VM reference: ${vmName} (PID: ${pid})`
          );
          delete vmController.runningVMs[vmName];
        }
      }
    } catch (error) {
      console.error("Error in VM process watcher:", error);
    }
  }, CHECK_INTERVAL);
}

// Start server
if (process.env.NODE_ENV !== "test") {
  const server = app
    .listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      setupVMProcessWatcher(); // Start the VM process watcher
    })
    .on("error", (err) => {
      if (err.code === "EADDRINUSE") {
        console.error(
          `Port ${PORT} is already in use. Trying port ${PORT + 1}`
        );

        // Try the next port
        const altPort = PORT + 1;
        app.listen(altPort, () => {
          console.log(`Server running on http://localhost:${altPort}`);
          setupVMProcessWatcher();
        });
      } else {
        console.error("Server error:", err);
      }
    });
}

// Global error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error handler caught:", err);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: err.toString(),
  });
});

// Export the app for testing
module.exports = app;
