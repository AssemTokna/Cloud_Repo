const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const diskController = require('./controllers/disk-controller');
const vmController = require('./controllers/vm-controller');
const { execSync } = require('child_process');
const { platform } = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: function(req, file, cb) {
        const isoDir = path.join(__dirname, '../../iso');
        // Create directory if it doesn't exist
        if (!fs.existsSync(isoDir)) {
            fs.mkdirSync(isoDir, { recursive: true });
        }
        cb(null, isoDir);
    },
    filename: function(req, file, cb) {
        cb(null, file.originalname);
    }
});
const upload = multer({ storage: storage });

// Application folders
const appDirs = {
    disks: path.join(__dirname, '../../disks'),
    vms: path.join(__dirname, '../../vm_configs'),
    iso: path.join(__dirname, '../../iso')
};

// Create folders if they don't exist
Object.values(appDirs).forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Routes
// Disk management
app.get('/api/disks', (req, res) => diskController.listDisks(req, res, appDirs));
app.post('/api/disks', (req, res) => diskController.createDisk(req, res, appDirs));
app.delete('/api/disks/:name', (req, res) => diskController.deleteDisk(req, res, appDirs));

// VM management
app.get('/api/vms', (req, res) => vmController.listRunningVMs(req, res));
app.post('/api/vms', (req, res) => vmController.createVM(req, res, appDirs));
app.post('/api/vms/stop', (req, res) => vmController.stopVM(req, res));
app.post('/api/vms/start', (req, res) => vmController.startVM(req, res, appDirs));
app.get('/api/vms/details', (req, res) => vmController.getVMDetails(req, res, appDirs));

// VM Configuration
app.get('/api/vms/configs', (req, res) => vmController.listVMConfigs(req, res, appDirs));
app.get('/api/vms/config/:name', (req, res) => vmController.getVMConfig(req, res, appDirs));
app.post('/api/vms/config', (req, res) => vmController.saveVMConfig(req, res, appDirs));
app.delete('/api/vms/config/:name', (req, res) => vmController.deleteVMConfig(req, res, appDirs));

// ISO upload
app.post('/api/upload-iso', upload.single('isoFile'), (req, res) => {
    if (req.file) {
        res.json({
            success: true,
            path: req.file.path
        });
    } else {
        res.status(400).json({
            success: false,
            message: 'No file uploaded'
        });
    }
});

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Add a process watcher to ensure VM status accuracy
// This runs periodically to clean up stale VM references
function setupVMProcessWatcher() {
    const CHECK_INTERVAL = 5000; // Check every 5 seconds
    
    setInterval(() => {
        try {
            const runningPIDs = [];
            
            // Get list of actually running QEMU processes
            if (platform() === 'win32') {
                const output = execSync('tasklist /FI "IMAGENAME eq qemu-system-x86_64.exe" /FO CSV', { encoding: 'utf8' });
                const lines = output.split('\n');
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        const parts = line.split(',');
                        if (parts.length >= 2) {
                            runningPIDs.push(parts[1].replace(/"/g, ''));
                        }
                    }
                }
            } else {
                const output = execSync("ps -eo pid,command | grep qemu-system-x86_64 | grep -v grep", { encoding: 'utf8' });
                const lines = output.split('\n');
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
                    console.log(`Auto-cleaning stale VM reference: ${vmName} (PID: ${pid})`);
                    delete vmController.runningVMs[vmName];
                }
            }
        } catch (error) {
            console.error('Error in VM process watcher:', error);
        }
    }, CHECK_INTERVAL);
}

// Start server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    setupVMProcessWatcher(); // Start the VM process watcher
});
