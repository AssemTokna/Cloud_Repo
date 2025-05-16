function initializeVMCreator() {
  const vmForm = document.getElementById("vm-form");
  const vmStatus = document.getElementById("vm-status");
  const browseIsoBtn = document.getElementById("browse-iso-btn");
  const isoFileInput = document.getElementById("iso-file");
  const isoPathInput = document.getElementById("iso-path");
  const saveVmBtn = document.getElementById("save-vm-btn");
  const loadVmBtn = document.getElementById("load-vm-btn");
  const cpuInput = document.getElementById("cpu-cores");
  const memoryInput = document.getElementById("memory");

  // System resource limits
  let systemResources = {
    cpu: { recommended: 2 },
    memory: { recommendedMB: 1024 },
    disk: { recommendedMaxGB: 10 },
  };

  // Fetch system resource limits
  function fetchSystemResources() {
    fetch("/api/system/resources")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          systemResources = data.resources;

          // Update input max attributes
          cpuInput.setAttribute("max", systemResources.cpu.recommended);
          cpuInput.setAttribute(
            "placeholder",
            `1-${systemResources.cpu.recommended} cores`
          );

          memoryInput.setAttribute("max", systemResources.memory.recommendedMB);
          memoryInput.setAttribute(
            "placeholder",
            `512-${systemResources.memory.recommendedMB} MB`
          );

          // Display resource information
          const statusInfo = document.createElement("div");
          statusInfo.className = "resource-info";
          statusInfo.innerHTML = `
                        <p>System Resources:</p>
                        <ul>
                            <li>CPU: Max ${
                              systemResources.cpu.recommended
                            } of ${systemResources.cpu.total} cores</li>
                            <li>Memory: Max ${Math.floor(
                              systemResources.memory.recommendedMB / 1024
                            )} GB of ${Math.floor(
            systemResources.memory.totalMB / 1024
          )} GB</li>
                            <li>Disk: Max ${
                              systemResources.disk.recommendedMaxGB
                            } GB free space</li>
                        </ul>
                    `;

          // Insert after the VM status element
          if (vmStatus.parentNode) {
            vmStatus.parentNode.insertBefore(statusInfo, vmStatus.nextSibling);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching system resources:", error);
      });
  }

  // Call function to fetch system resources
  fetchSystemResources();

  // Add validators for CPU and memory inputs
  cpuInput.addEventListener("change", function () {
    const value = parseInt(this.value);
    const max = parseInt(this.getAttribute("max"));

    if (isNaN(value) || value < 1) {
      this.value = 1;
      vmStatus.textContent = "CPU cores must be at least 1";
    } else if (value > max) {
      this.value = max;
      vmStatus.textContent = `CPU cores cannot exceed ${max} (system limit)`;
    } else {
      vmStatus.textContent = "";
    }
  });

  memoryInput.addEventListener("change", function () {
    const value = parseInt(this.value);
    const max = parseInt(this.getAttribute("max"));
    const min = 512; // 512MB minimum

    if (isNaN(value) || value < min) {
      this.value = min;
      vmStatus.textContent = `Memory must be at least ${min} MB`;
    } else if (value > max) {
      this.value = max;
      vmStatus.textContent = `Memory cannot exceed ${max} MB (system limit)`;
    } else {
      vmStatus.textContent = "";
    }
  });

  // Browse ISO button
  browseIsoBtn.addEventListener("click", function () {
    isoFileInput.click();
  });

  // Handle file selection
  isoFileInput.addEventListener("change", function () {
    if (this.files.length > 0) {
      const file = this.files[0];

      // Validate that the file is an ISO file
      if (!file.name.toLowerCase().endsWith(".iso")) {
        vmStatus.textContent =
          "Error: Please select a valid ISO file (.iso extension)";
        // Clear the file input
        this.value = "";
        return;
      }

      isoPathInput.value = file.name;

      // Upload the ISO file to the server
      const formData = new FormData();
      formData.append("isoFile", file);

      vmStatus.textContent = "Uploading ISO file...";

      fetch("/api/upload-iso", {
        method: "POST",
        body: formData,
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            isoPathInput.value = data.path;
            vmStatus.textContent = "ISO uploaded successfully.";
          } else {
            vmStatus.textContent = `Error uploading ISO: ${data.message}`;
          }
        })
        .catch((error) => {
          console.error("Error uploading ISO:", error);
          vmStatus.textContent = `Error uploading ISO: ${
            error.message || "Unknown error"
          }`;
        });
    }
  });

  // Save VM configuration
  saveVmBtn.addEventListener("click", function () {
    const vmName = document.getElementById("vm-name").value;

    if (!vmName) {
      vmStatus.textContent = "Please enter a VM name.";
      return;
    }

    const config = {
      name: vmName,
      cpu: document.getElementById("cpu-cores").value,
      memory: document.getElementById("memory").value,
      disk: document.getElementById("disk-select").value,
      iso: isoPathInput.value,
    };

    fetch("/api/vms/config", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(config),
    })
      .then((response) => response.json())
      .then((data) => {
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
  loadVmBtn.addEventListener("click", function () {
    // Switch to the Manage VMs tab
    document.querySelector('.tab-item[data-tab="manage-tab"]').click();
  });

  // Create VM form submission
  vmForm.addEventListener("submit", function (e) {
    e.preventDefault();

    const vmName = document.getElementById("vm-name").value;
    const diskFile = document.getElementById("disk-select").value;
    const cpuValue = parseInt(cpuInput.value);
    const memoryValue = parseInt(memoryInput.value);

    // Basic validation
    if (!vmName) {
      vmStatus.textContent = "Please enter a VM name.";
      return;
    }

    if (!diskFile) {
      vmStatus.textContent = "Please select a disk.";
      return;
    }

    // Validate CPU cores
    if (
      isNaN(cpuValue) ||
      cpuValue < 1 ||
      cpuValue > systemResources.cpu.recommended
    ) {
      vmStatus.textContent = `CPU cores must be between 1 and ${systemResources.cpu.recommended}`;
      return;
    }

    // Validate memory
    if (
      isNaN(memoryValue) ||
      memoryValue < 512 ||
      memoryValue > systemResources.memory.recommendedMB
    ) {
      vmStatus.textContent = `Memory must be between 512 MB and ${systemResources.memory.recommendedMB} MB`;
      return;
    }

    // Validate ISO if provided
    if (
      isoPathInput.value &&
      !isoPathInput.value.toLowerCase().endsWith(".iso")
    ) {
      vmStatus.textContent = "ISO file must have .iso extension";
      return;
    }

    vmStatus.textContent = "Creating VM...";

    // First save the configuration
    saveVmBtn.click();

    // Then create and start the VM
    const vmConfig = {
      name: vmName,
      cpu: cpuValue,
      memory: memoryValue,
      disk: diskFile,
      iso: isoPathInput.value,
    };

    fetch("/api/vms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(vmConfig),
    })
      .then((response) => response.json())
      .then((data) => {
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
