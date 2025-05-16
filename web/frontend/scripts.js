document.addEventListener('DOMContentLoaded', function() {
    // Tab switching functionality
    const tabItems = document.querySelectorAll('.tab-item');
    const tabPanes = document.querySelectorAll('.tab-pane');
      tabItems.forEach(tab => {
        tab.addEventListener('click', function() {
            // Remove active class from all tabs
            tabItems.forEach(item => item.classList.remove('active'));
            tabPanes.forEach(pane => pane.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding pane
            const tabId = this.getAttribute('data-tab');
            this.classList.add('active');
            document.getElementById(tabId).classList.add('active');
            
            // Special handling for Docker tab
            if (tabId === 'docker-tab') {
                console.log('Docker tab activated');
                // Refresh Docker data when tab is clicked
                if (typeof loadDockerImages === 'function') {
                    loadDockerImages();
                }
                if (typeof loadRunningContainers === 'function') {
                    loadRunningContainers();
                }
            }
        });
    });
    
    // Modal functionality
    const modal = document.getElementById('vm-details-modal');
    const closeModal = document.querySelector('.close');
    
    closeModal.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    });
    
    // QEMU Installation Modal
    const qemuInstallModal = document.getElementById('qemu-install-modal');
    const closeQemuModal = qemuInstallModal.querySelector('.close');
    const closeQemuBtn = document.getElementById('close-install-modal');
    
    window.showQemuInstallModal = function() {
        qemuInstallModal.style.display = 'block';
    };
    
    closeQemuModal.addEventListener('click', function() {
        qemuInstallModal.style.display = 'none';
    });
    
    closeQemuBtn.addEventListener('click', function() {
        qemuInstallModal.style.display = 'none';
    });
    
    // Add another event listener for qemuInstallModal closing on outside click
    window.addEventListener('click', function(event) {
        if (event.target === qemuInstallModal) {
            qemuInstallModal.style.display = 'none';
        }
    });
    
    // Global error handler for fetch requests
    window.handleFetchError = function(error) {
        console.error('Fetch error:', error);
        document.getElementById('global-status').textContent = 'Error: ' + error.message;
    };    // Initialize components
    initializeDiskManager();
    initializeVMCreator();
    initializeVMManager();
    initializeDockerManager();
    
    // Update status
    document.getElementById('global-status').textContent = 'Ready';
});
