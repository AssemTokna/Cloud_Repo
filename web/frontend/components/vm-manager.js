function initializeVMManager() {
    const vmList = document.getElementById('vm-list');
    const savedVmList = document.getElementById('saved-vm-list');
    const refreshVmBtn = document.getElementById('refresh-vm-btn');
    const stopVmBtn = document.getElementById('stop-vm-btn');
    const viewDetailsBtn = document.getElementById('view-details-btn');
    const startSavedVmBtn = document.getElementById('start-saved-vm-btn');
    const editConfigBtn = document.getElementById('edit-config-btn');
    const deleteConfigBtn = document.getElementById('delete-config-btn');
    const manageStatus = document.getElementById('manage-status');
    const detailsModal = document.getElementById('vm-details-modal');
    const detailsContent = document.getElementById('vm-details-content');
    
    // Load VM lists on page load
    loadVMList();
    loadSavedVMList();
    
    // Refresh VM list button - improved to ensure accuracy
    refreshVmBtn.addEventListener('click', function() {
        manageStatus.textContent = "Checking VM status...";
        loadVMList();
    });
    
    // Stop VM button
    stopVmBtn.addEventListener('click', function() {
        const selectedVm = vmList.value;
        
        if (!selectedVm) {
            manageStatus.textContent = 'No VM selected to stop.';
            return;
        }
        
        // Parse PID from VM name if present
        let pid = null;
        let vmName = selectedVm;
        
        if (selectedVm.includes("(PID:")) {
            const pidStart = selectedVm.indexOf("PID:") + 4;
            const pidEnd = selectedVm.indexOf(")", pidStart);
            pid = selectedVm.substring(pidStart, pidEnd).trim();
            vmName = selectedVm.split(" (PID:")[0];
        }
        
        // Send request to stop VM
        fetch('/api/vms/stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: vmName,
                pid: pid
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                manageStatus.textContent = `Stopped VM '${vmName}'.`;
                loadVMList();
            } else {
                manageStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // View VM details button
    viewDetailsBtn.addEventListener('click', function() {
        const selectedVm = vmList.value;
        
        if (!selectedVm) {
            manageStatus.textContent = 'No VM selected to view details.';
            return;
        }
        
        // Parse VM name and PID from selection
        let pid = null;
        let vmName = selectedVm;
        
        if (selectedVm.includes("(PID:")) {
            const pidStart = selectedVm.indexOf("PID:") + 4;
            const pidEnd = selectedVm.indexOf(")", pidStart);
            pid = selectedVm.substring(pidStart, pidEnd).trim();
            vmName = selectedVm.split(" (PID:")[0];
        }
        
        // Fetch VM details
        fetch(`/api/vms/details?name=${encodeURIComponent(vmName)}&pid=${pid || ''}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Show details in modal
                detailsContent.textContent = data.details;
                detailsModal.style.display = 'block';
            } else {
                manageStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Start saved VM button
    startSavedVmBtn.addEventListener('click', function() {
        const selectedVm = savedVmList.value;
        
        if (!selectedVm) {
            manageStatus.textContent = 'No saved VM configuration selected.';
            return;
        }
        
        // Send request to start VM
        fetch('/api/vms/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: selectedVm
            })
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                manageStatus.textContent = `VM '${selectedVm}' started.`;
                loadVMList();
            } else {
                manageStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Edit VM configuration button
    editConfigBtn.addEventListener('click', function() {
        const selectedVm = savedVmList.value;
        
        if (!selectedVm) {
            manageStatus.textContent = 'No saved VM configuration selected.';
            return;
        }
        
        // Fetch VM configuration
        fetch(`/api/vms/config/${encodeURIComponent(selectedVm)}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                // Switch to Create VM tab
                document.querySelector('.tab-item[data-tab="vm-tab"]').click();
                
                // Fill form with VM configuration
                document.getElementById('vm-name').value = data.config.name;
                document.getElementById('cpu-cores').value = data.config.cpu;
                document.getElementById('memory').value = data.config.memory;
                
                const diskSelect = document.getElementById('disk-select');
                for (let i = 0; i < diskSelect.options.length; i++) {
                    if (diskSelect.options[i].value === data.config.disk) {
                        diskSelect.selectedIndex = i;
                        break;
                    }
                }
                
                document.getElementById('iso-path').value = data.config.iso || '';
                document.getElementById('vm-status').textContent = `Loaded VM configuration '${selectedVm}'.`;
            } else {
                manageStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Delete VM configuration button
    deleteConfigBtn.addEventListener('click', function() {
        const selectedVm = savedVmList.value;
        
        if (!selectedVm) {
            manageStatus.textContent = 'No saved VM configuration selected.';
            return;
        }
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete VM configuration '${selectedVm}'?`)) {
            return;
        }
        
        // Send request to delete VM configuration
        fetch(`/api/vms/config/${encodeURIComponent(selectedVm)}`, {
            method: 'DELETE'
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                manageStatus.textContent = `VM configuration '${selectedVm}' deleted.`;
                loadSavedVMList();
            } else {
                manageStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Function to load VM list with better status validation
    function loadVMList() {
        fetch('/api/vms?validate=true')  // Add validation flag
        .then(response => response.json())
        .then(data => {
            // Clear existing options
            vmList.innerHTML = '';
            
            // Add VMs to list
            if (data.vms.length === 0) {
                manageStatus.textContent = 'No running VMs found.';
            } else {
                data.vms.forEach(vm => {
                    const option = document.createElement('option');
                    option.value = vm;
                    option.textContent = vm;
                    vmList.appendChild(option);
                });
                manageStatus.textContent = `Found ${data.vms.length} running VM(s).`;
            }
        })
        .catch(window.handleFetchError);
    }
    
    // Function to load saved VM configurations
    function loadSavedVMList() {
        fetch('/api/vms/configs')
        .then(response => response.json())
        .then(data => {
            // Clear existing options
            savedVmList.innerHTML = '';
            
            // Add saved configurations to list
            data.configs.forEach(config => {
                const option = document.createElement('option');
                option.value = config;
                option.textContent = config;
                savedVmList.appendChild(option);
            });
        })
        .catch(window.handleFetchError);
    }
    
    // Expose functions for other components to use
    window.loadVMList = loadVMList;
    window.loadSavedVMList = loadSavedVMList;
}
