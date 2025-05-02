function initializeVMCreator() {
    const vmForm = document.getElementById('vm-form');
    const vmStatus = document.getElementById('vm-status');
    const browseIsoBtn = document.getElementById('browse-iso-btn');
    const isoFileInput = document.getElementById('iso-file');
    const isoPathInput = document.getElementById('iso-path');
    const saveVmBtn = document.getElementById('save-vm-btn');
    const loadVmBtn = document.getElementById('load-vm-btn');
    
    // Browse ISO button
    browseIsoBtn.addEventListener('click', function() {
        isoFileInput.click();
    });
    
    // Handle file selection
    isoFileInput.addEventListener('change', function() {
        if (this.files.length > 0) {
            isoPathInput.value = this.files[0].name;
            
            // Upload the ISO file to the server
            const formData = new FormData();
            formData.append('isoFile', this.files[0]);
            
            fetch('/api/upload-iso', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    isoPathInput.value = data.path;
                    vmStatus.textContent = 'ISO uploaded successfully.';
                } else {
                    vmStatus.textContent = `Error uploading ISO: ${data.message}`;
                }
            })
            .catch(window.handleFetchError);
        }
    });
    
    // Save VM configuration
    saveVmBtn.addEventListener('click', function() {
        const vmName = document.getElementById('vm-name').value;
        
        if (!vmName) {
            vmStatus.textContent = 'Please enter a VM name.';
            return;
        }
        
        const config = {
            name: vmName,
            cpu: document.getElementById('cpu-cores').value,
            memory: document.getElementById('memory').value,
            disk: document.getElementById('disk-select').value,
            iso: isoPathInput.value
        };
        
        fetch('/api/vms/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(config)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                vmStatus.textContent = `VM configuration '${vmName}' saved.`;
                // Update saved VM list
                if (window.loadSavedVMList) {
                    window.loadSavedVMList();
                }
            } else {
                vmStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Load VM configuration button (switches to Manage VMs tab)
    loadVmBtn.addEventListener('click', function() {
        // Switch to the Manage VMs tab
        document.querySelector('.tab-item[data-tab="manage-tab"]').click();
    });
    
    // Create VM form submission
    vmForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const vmName = document.getElementById('vm-name').value;
        const diskFile = document.getElementById('disk-select').value;
        
        if (!vmName) {
            vmStatus.textContent = 'Please enter a VM name.';
            return;
        }
        
        if (!diskFile) {
            vmStatus.textContent = 'Please select a disk.';
            return;
        }
        
        // First save the configuration
        saveVmBtn.click();
        
        // Then create and start the VM
        const vmConfig = {
            name: vmName,
            cpu: document.getElementById('cpu-cores').value,
            memory: document.getElementById('memory').value,
            disk: diskFile,
            iso: isoPathInput.value
        };
        
        fetch('/api/vms', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(vmConfig)
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                if (vmConfig.iso) {
                    vmStatus.textContent = `VM '${vmName}' started (booting from ISO).`;
                } else {
                    vmStatus.textContent = `VM '${vmName}' started (booting from disk).`;
                }
                
                // Update VM list
                if (window.loadVMList) {
                    window.loadVMList();
                }
            } else {
                vmStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
}
