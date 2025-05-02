function initializeDiskManager() {
    const diskForm = document.getElementById('disk-form');
    const diskStatus = document.getElementById('disk-status');
    const diskList = document.getElementById('disk-list');
    const deleteDiskBtn = document.getElementById('delete-disk-btn');
    
    // Load disk list on page load
    loadDiskList();
    
    // Create disk form submission
    diskForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const diskType = document.getElementById('disk-type').value;
        const diskSize = document.getElementById('disk-size').value;
        const diskName = document.getElementById('disk-name').value;
        
        if (!diskName) {
            diskStatus.textContent = 'Please enter a disk name.';
            return;
        }
        
        // Send request to create disk
        fetch('/api/disks', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                type: diskType,
                size: diskSize,
                name: diskName
            }),
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                diskStatus.textContent = `Disk '${data.diskName}' created successfully.`;
                diskForm.reset();
                loadDiskList();
            } else {
                diskStatus.textContent = `Error: ${data.message}`;
                
                // Show QEMU installation help if QEMU is not found
                if (data.message.includes("QEMU is not installed") || 
                    data.message.includes("not recognized")) {
                    showQemuInstallModal();
                }
            }
        })
        .catch(error => {
            window.handleFetchError(error);
            diskStatus.textContent = `Error: ${error.message}`;
        });
    });
    
    // Delete disk button
    deleteDiskBtn.addEventListener('click', function() {
        const selectedDisk = diskList.value;
        
        if (!selectedDisk) {
            diskStatus.textContent = 'No disk selected to delete.';
            return;
        }
        
        // Confirm deletion
        if (!confirm(`Are you sure you want to delete disk '${selectedDisk}'?`)) {
            return;
        }
        
        // Send request to delete disk
        fetch(`/api/disks/${encodeURIComponent(selectedDisk)}`, {
            method: 'DELETE',
        })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                diskStatus.textContent = `Disk '${selectedDisk}' deleted.`;
                loadDiskList();
            } else {
                diskStatus.textContent = `Error: ${data.message}`;
            }
        })
        .catch(window.handleFetchError);
    });
    
    // Function to load disk list
    function loadDiskList() {
        fetch('/api/disks')
        .then(response => response.json())
        .then(data => {
            // Clear existing options
            diskList.innerHTML = '';
            const diskSelect = document.getElementById('disk-select');
            diskSelect.innerHTML = '';
            
            // Add disks to both lists
            data.disks.forEach(disk => {
                const option1 = document.createElement('option');
                option1.value = disk;
                option1.textContent = disk;
                diskList.appendChild(option1);
                
                const option2 = document.createElement('option');
                option2.value = disk;
                option2.textContent = disk;
                diskSelect.appendChild(option2);
            });
        })
        .catch(window.handleFetchError);
    }
    
    // Expose the loadDiskList function for other components to use
    window.loadDiskList = loadDiskList;
}
