const fs = require('fs');
const path = require('path');
const { exec, execSync } = require('child_process');
const { platform } = require('os');

// Track running VMs - make it accessible to the watcher in server.js
const runningVMs = {};
exports.runningVMs = runningVMs;

// Helper function to check if QEMU is available
function checkQemuAvailability() {
    try {
        if (platform() === 'win32') {
            // On Windows, check both in PATH and common installation directories
            try {
                execSync('where qemu-system-x86_64', { stdio: 'ignore' });
                return { available: true };
            } catch {
                // Check common installation directories
                const commonPaths = [
                    'C:\\Program Files\\qemu',
                    'C:\\Program Files (x86)\\qemu',
                    process.env.USERPROFILE + '\\qemu',
                    'C:\\qemu'
                ];
                
                for (const qemuPath of commonPaths) {
                    const vmPath = path.join(qemuPath, 'qemu-system-x86_64.exe');
                    if (fs.existsSync(vmPath)) {
                        return { 
                            available: true, 
                            path: vmPath 
                        };
                    }
                }
                
                return { 
                    available: false, 
                    message: "QEMU is not installed or not in your PATH. Please install QEMU and make sure it's in your system PATH." 
                };
            }
        } else {
            // On Linux/macOS
            try {
                execSync('which qemu-system-x86_64', { stdio: 'ignore' });
                return { available: true };
            } catch {
                return { 
                    available: false, 
                    message: "QEMU is not installed or not in your PATH. Please install QEMU with your package manager." 
                };
            }
        }
    } catch (error) {
        return { 
            available: false, 
            message: `Error checking QEMU: ${error.message}` 
        };
    }
}

// List running VMs
exports.listRunningVMs = (req, res) => {
    try {
        const vms = [];
        const runningPIDs = []; // Track actually running PIDs
        
        // Get running QEMU processes
        if (platform() === 'win32') {
            // Windows
            const output = execSync('tasklist /FI "IMAGENAME eq qemu-system-x86_64.exe" /FO CSV', { encoding: 'utf8' });
            const lines = output.split('\n');
            if (lines.length > 1) {
                for (let i = 1; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (line) {
                        const parts = line.split(',');
                        if (parts.length >= 2) {
                            const pid = parts[1].replace(/"/g, '');
                            runningPIDs.push(pid); // Add to running PIDs list
                            const vmName = getVMNameFromPID(pid);
                            if (vmName) {
                                vms.push(vmName);
                            } else {
                                vms.push(`QEMU VM #${i} (PID: ${pid})`);
                            }
                        }
                    }
                }
            }
        } else {
            // Unix/Linux
            const output = execSync("ps -eo pid,command | grep qemu-system-x86_64 | grep -v grep", { encoding: 'utf8' });
            const lines = output.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line) {
                    const parts = line.split(/\s+/);
                    if (parts.length >= 2) {
                        const pid = parts[0];
                        runningPIDs.push(pid); // Add to running PIDs list
                        const vmName = getVMNameFromPID(pid);
                        if (vmName) {
                            vms.push(vmName);
                        } else {
                            vms.push(`QEMU VM #${i+1} (PID: ${pid})`);
                        }
                    }
                }
            }
        }

        // Cleanup stale VM entries in the runningVMs tracking object
        // This ensures we don't show terminated VMs as running
        for (const vmName in runningVMs) {
            const pid = runningVMs[vmName].pid;
            if (!runningPIDs.includes(String(pid))) {
                console.log(`Removing stale VM: ${vmName} with PID ${pid}`);
                delete runningVMs[vmName];
            }
        }
        
        res.json({
            success: true,
            vms: vms
        });
    } catch (error) {
        console.error('Error listing VMs:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Create and start a VM
exports.createVM = (req, res, appDirs) => {
    try {
        // First check if QEMU is available
        const qemuCheck = checkQemuAvailability();
        if (!qemuCheck.available) {
            return res.status(500).json({
                success: false,
                message: qemuCheck.message
            });
        }

        const { name, cpu, memory, disk, iso } = req.body;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a VM name.'
            });
        }
        
        if (!disk) {
            return res.status(400).json({
                success: false,
                message: 'Please select a disk.'
            });
        }
        
        const diskPath = path.join(appDirs.disks, disk);
        
        if (!fs.existsSync(diskPath)) {
            return res.status(404).json({
                success: false,
                message: `Disk '${disk}' not found.`
            });
        }
        
        // Build QEMU command
        let command = [
            'qemu-system-x86_64',
            `-name "${name}"`,
            `-m ${memory}`,
            `-smp ${cpu}`,
            `-drive file="${diskPath}",format=${disk.split('.').pop()},if=virtio`,
            '-net nic',
            '-net user'
        ];
        
        // Add ISO if specified
        if (iso && fs.existsSync(iso)) {
            command.push(`-cdrom "${iso}"`);
            command.push('-boot d');
        }
        
        // Join command parts
        const commandString = command.join(' ');
        
        // Start the VM process
        const process = exec(commandString, {
            cwd: appDirs.disks,
            windowsHide: false // Show window on Windows
        });
        
        // Store VM process information
        const pid = process.pid;
        runningVMs[name] = {
            pid: pid,
            config: {
                cpu: cpu,
                memory: memory,
                disk: disk,
                iso: iso,
                started: getCurrentTimestamp()
            }
        };
        
        res.json({
            success: true,
            message: `VM '${name}' started.`,
            pid: pid
        });
    } catch (error) {
        console.error('Error creating VM:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Stop a running VM
exports.stopVM = (req, res) => {
    try {
        const { name, pid } = req.body;
        
        if (pid) {
            // Stop VM by PID
            if (platform() === 'win32') {
                execSync(`taskkill /F /PID ${pid}`);
            } else {
                execSync(`kill -9 ${pid}`);
            }
            res.json({
                success: true,
                message: `Stopped VM with PID ${pid}.`
            });
        } else if (name && runningVMs[name]) {
            // Stop VM by name
            const vmPid = runningVMs[name].pid;
            if (platform() === 'win32') {
                execSync(`taskkill /F /PID ${vmPid}`);
            } else {
                execSync(`kill -9 ${vmPid}`);
            }
            delete runningVMs[name];
            res.json({
                success: true,
                message: `Stopped VM '${name}'.`
            });
        } else {
            // Last resort: kill all QEMU processes
            if (platform() === 'win32') {
                execSync('taskkill /F /IM qemu-system-x86_64.exe');
            } else {
                execSync('killall qemu-system-x86_64');
            }
            res.json({
                success: true,
                message: 'Stopped all QEMU VMs.'
            });
        }
    } catch (error) {
        console.error('Error stopping VM:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Start a VM from saved configuration
exports.startVM = (req, res, appDirs) => {
    try {
        // First check if QEMU is available
        const qemuCheck = checkQemuAvailability();
        if (!qemuCheck.available) {
            return res.status(500).json({
                success: false,
                message: qemuCheck.message
            });
        }

        const { name } = req.body;
        
        // Check if VM is already running
        if (runningVMs[name]) {
            // Verify the process with the stored PID actually exists
            const pid = runningVMs[name].pid;
            let processExists = false;
            
            try {
                if (platform() === 'win32') {
                    const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV`, { encoding: 'utf8' });
                    processExists = output.includes(`"${pid}"`);
                } else {
                    // Check if process exists on Unix/Linux
                    const output = execSync(`ps -p ${pid} -o pid=`, { encoding: 'utf8' });
                    processExists = output.trim() !== '';
                }
            } catch (e) {
                // Process doesn't exist
                processExists = false;
            }
            
            if (processExists) {
                return res.status(400).json({
                    success: false,
                    message: `VM '${name}' is already running.`
                });
            } else {
                // Clean up stale entry
                delete runningVMs[name];
            }
        }
        
        // Get VM configuration
        const vmConfigPath = path.join(appDirs.vms, 'vms.json');
        if (!fs.existsSync(vmConfigPath)) {
            return res.status(404).json({
                success: false,
                message: 'No VM configurations found.'
            });
        }
        
        const configs = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
        
        if (!configs[name]) {
            return res.status(404).json({
                success: false,
                message: `VM configuration '${name}' not found.`
            });
        }
        
        const config = configs[name];
        
        // Validate disk
        const diskPath = path.join(appDirs.disks, config.disk);
        if (!fs.existsSync(diskPath)) {
            return res.status(404).json({
                success: false,
                message: `Disk '${config.disk}' not found.`
            });
        }
        
        // Build QEMU command
        let command = [
            'qemu-system-x86_64',
            `-name "${name}"`,
            `-m ${config.memory}`,
            `-smp ${config.cpu}`,
            `-drive file="${diskPath}",format=${config.disk.split('.').pop()},if=virtio`,
            '-net nic',
            '-net user'
        ];
        
        // Add ISO if specified and exists
        if (config.iso && fs.existsSync(config.iso)) {
            command.push(`-cdrom "${config.iso}"`);
            command.push('-boot d');
        }
        
        // Join command parts
        const commandString = command.join(' ');
        
        // Start the VM process
        const process = exec(commandString, {
            cwd: appDirs.disks,
            windowsHide: false // Show window on Windows
        });
        
        // Store VM process information
        const pid = process.pid;
        runningVMs[name] = {
            pid: pid,
            config: {
                ...config,
                started: getCurrentTimestamp()
            }
        };
        
        res.json({
            success: true,
            message: `VM '${name}' started.`,
            pid: pid
        });
    } catch (error) {
        console.error('Error starting VM:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get VM details
exports.getVMDetails = (req, res, appDirs) => {
    try {
        const { name, pid } = req.query;
        
        let vmConfig = null;
        let vmPid = pid;
        let vmName = name;
        
        // Try to get info from running VMs
        if (name && runningVMs[name]) {
            vmConfig = runningVMs[name].config;
            vmPid = runningVMs[name].pid;
        } else if (pid) {
            // Try to find VM by PID
            for (const [key, value] of Object.entries(runningVMs)) {
                if (value.pid == pid) {
                    vmConfig = value.config;
                    vmName = key;
                    break;
                }
            }
        }
        
        // If not found in running VMs, try to get from config file
        if (!vmConfig) {
            const vmConfigPath = path.join(appDirs.vms, 'vms.json');
            if (fs.existsSync(vmConfigPath)) {
                const configs = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
                if (configs[name]) {
                    vmConfig = configs[name];
                }
            }
        }
        
        // Build details string
        let details = `Details for VM: ${vmName || 'Unknown'}\n\n`;
        
        if (vmPid) {
            details += `Process ID: ${vmPid}\n`;
        }
        
        if (vmConfig) {
            details += `CPU cores: ${vmConfig.cpu || 'Unknown'}\n`;
            details += `Memory: ${vmConfig.memory || 'Unknown'} MB\n`;
            details += `Disk: ${vmConfig.disk || 'Unknown'}\n`;
            if (vmConfig.iso) {
                details += `ISO: ${vmConfig.iso}\n`;
            }
            if (vmConfig.started) {
                details += `Started: ${vmConfig.started}\n`;
            }
        } else {
            details += 'No saved configuration found for this VM.\n';
        }
        
        res.json({
            success: true,
            details: details
        });
    } catch (error) {
        console.error('Error getting VM details:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// List VM configurations
exports.listVMConfigs = (req, res, appDirs) => {
    try {
        const vmConfigPath = path.join(appDirs.vms, 'vms.json');
        let configs = [];
        
        if (fs.existsSync(vmConfigPath)) {
            const configData = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
            configs = Object.keys(configData);
        }
        
        res.json({
            success: true,
            configs: configs
        });
    } catch (error) {
        console.error('Error listing VM configs:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Get a specific VM configuration
exports.getVMConfig = (req, res, appDirs) => {
    try {
        const name = req.params.name;
        const vmConfigPath = path.join(appDirs.vms, 'vms.json');
        
        if (!fs.existsSync(vmConfigPath)) {
            return res.status(404).json({
                success: false,
                message: 'No VM configurations found.'
            });
        }
        
        const configs = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
        
        if (!configs[name]) {
            return res.status(404).json({
                success: false,
                message: `VM configuration '${name}' not found.`
            });
        }
        
        res.json({
            success: true,
            config: configs[name]
        });
    } catch (error) {
        console.error('Error getting VM config:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Save a VM configuration
exports.saveVMConfig = (req, res, appDirs) => {
    try {
        const config = req.body;
        const name = config.name;
        
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a VM name.'
            });
        }
        
        const vmConfigPath = path.join(appDirs.vms, 'vms.json');
        let configs = {};
        
        // Load existing configs if they exist
        if (fs.existsSync(vmConfigPath)) {
            configs = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
        }
        
        // Add or update this VM
        configs[name] = config;
        
        // Save back to file
        fs.writeFileSync(vmConfigPath, JSON.stringify(configs, null, 2));
        
        res.json({
            success: true,
            message: `VM configuration '${name}' saved.`
        });
    } catch (error) {
        console.error('Error saving VM config:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Delete a VM configuration
exports.deleteVMConfig = (req, res, appDirs) => {
    try {
        const name = req.params.name;
        const vmConfigPath = path.join(appDirs.vms, 'vms.json');
        
        if (!fs.existsSync(vmConfigPath)) {
            return res.status(404).json({
                success: false,
                message: 'No VM configurations found.'
            });
        }
        
        let configs = JSON.parse(fs.readFileSync(vmConfigPath, 'utf8'));
        
        if (!configs[name]) {
            return res.status(404).json({
                success: false,
                message: `VM configuration '${name}' not found.`
            });
        }
        
        // Delete the configuration
        delete configs[name];
        
        // Save back to file
        fs.writeFileSync(vmConfigPath, JSON.stringify(configs, null, 2));
        
        res.json({
            success: true,
            message: `VM configuration '${name}' deleted.`
        });
    } catch (error) {
        console.error('Error deleting VM config:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// Helper function to get VM name from PID
function getVMNameFromPID(pid) {
    try {
        // Check our tracked VMs first
        for (const [name, vm] of Object.entries(runningVMs)) {
            if (vm.pid == pid) {
                return name;
            }
        }
        
        // Try to get from command line arguments
        if (platform() === 'win32') {
            try {
                const output = execSync(`wmic process where processid="${pid}" get commandline /format:list`, { encoding: 'utf8' });
                if (output.includes('-name')) {
                    const nameIndex = output.indexOf('-name');
                    const nameEndIndex = output.indexOf(' ', nameIndex + 6);
                    const namePart = output.substring(nameIndex + 6, nameEndIndex > 0 ? nameEndIndex : undefined);
                    return namePart.trim().replace(/"/g, '');
                }
            } catch (error) {
                console.error('Error getting VM name from PID:', error);
            }
        } else {
            try {
                const output = execSync(`ps -p ${pid} -o command`, { encoding: 'utf8' });
                if (output.includes('-name')) {
                    const lines = output.split('\n');
                    const cmdLine = lines[1] || '';
                    const nameIndex = cmdLine.indexOf('-name');
                    if (nameIndex >= 0) {
                        const namePart = cmdLine.substring(nameIndex + 6).split(' ')[0];
                        return namePart.trim().replace(/"/g, '');
                    }
                }
            } catch (error) {
                console.error('Error getting VM name from PID:', error);
            }
        }
    } catch (error) {
        console.error('Error in getVMNameFromPID:', error);
    }
    
    return null;
}

// Helper function to get current timestamp
function getCurrentTimestamp() {
    return new Date().toISOString().replace('T', ' ').substr(0, 19);
}
