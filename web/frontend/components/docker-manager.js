// Docker Manager Component
function initializeDockerManager() {
  console.log("Initializing Docker Manager");

  // DOM elements - Create Dockerfile
  const createDockerfileForm = document.getElementById(
    "create-dockerfile-form"
  );
  const dockerfileSavePath = document.getElementById("dockerfile-save-path");
  const dockerfileContent = document.getElementById("dockerfile-content");
  const createDockerfileBtn = document.getElementById("create-dockerfile-btn");
  const createDockerfileStatus = document.getElementById(
    "create-dockerfile-status"
  );

  // DOM elements - Build Docker Image
  const dockerBuildForm = document.getElementById("docker-build-form");
  const dockerfilePath = document.getElementById("dockerfile-path");
  const dockerImageName = document.getElementById("docker-image-name");
  const dockerImageTag = document.getElementById("docker-image-tag");
  const buildDockerBtn = document.getElementById("build-docker-btn");
  const dockerBuildStatus = document.getElementById("docker-build-status");

  // DOM elements - Docker Images
  const refreshImagesBtn = document.getElementById("refresh-images-btn");
  const dockerImagesTable = document
    .getElementById("docker-images-table")
    .querySelector("tbody");

  // DOM elements - Create Container
  const createContainerForm = document.getElementById("create-container-form");
  const containerImage = document.getElementById("container-image");
  const containerName = document.getElementById("container-name");
  const containerPorts = document.getElementById("container-ports");
  const containerVolumes = document.getElementById("container-volumes");
  const containerEnv = document.getElementById("container-env");
  const containerCommand = document.getElementById("container-command");
  const createContainerBtn = document.getElementById("create-container-btn");
  const createContainerStatus = document.getElementById(
    "create-container-status"
  );

  // DOM elements - Running Containers
  const refreshContainersBtn = document.getElementById(
    "refresh-containers-btn"
  );
  const dockerContainersTable = document
    .getElementById("docker-containers-table")
    .querySelector("tbody");

  // DOM elements - Search Images
  const imageSearchType = document.getElementById("image-search-type");
  const imageSearchTerm = document.getElementById("image-search-term");
  const searchImageBtn = document.getElementById("search-image-btn");
  const imageSearchResultsHeader = document.getElementById(
    "image-search-results-header"
  );
  const imageSearchResultsTable = document
    .getElementById("image-search-results-table")
    .querySelector("tbody");
  const imageSearchStatus = document.getElementById("image-search-status");

  // DOM elements - Pull Image
  const pullImageForm = document.getElementById("pull-image-form");
  const pullImageName = document.getElementById("pull-image-name");
  const pullImageTag = document.getElementById("pull-image-tag");
  const pullImageBtn = document.getElementById("pull-image-btn");
  const pullImageStatus = document.getElementById("pull-image-status");
  // 1. Create Dockerfile
  if (createDockerfileForm) {
    console.log("Adding event listener to create-dockerfile-form");
    createDockerfileForm.addEventListener("submit", function (e) {
      e.preventDefault();
      console.log("Dockerfile form submitted");

      const savePath = dockerfileSavePath.value.trim();
      const content = dockerfileContent.value.trim();

      if (!savePath || !content) {
        createDockerfileStatus.textContent =
          "Please provide both Dockerfile path and content";
        return;
      }

      createDockerfileStatus.textContent = "Creating Dockerfile...";
      createDockerfileBtn.disabled = true;

      fetch("/api/docker/dockerfile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dockerfilePath: savePath,
          content: content,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            createDockerfileStatus.textContent = data.message;
            // Pre-populate the build form with the path
            dockerfilePath.value = savePath;
          } else {
            createDockerfileStatus.textContent = `Error: ${data.message}`;
            console.error(data.error);
          }
        })
        .catch((error) => {
          createDockerfileStatus.textContent = `Error: ${error.message}`;
          console.error("Error creating Dockerfile:", error);
        })
        .finally(() => {
          createDockerfileBtn.disabled = false;
        });
    });
  }
  // 2. Build Docker Image
  if (dockerBuildForm) {
    dockerBuildForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const path = dockerfilePath.value.trim();
      const name = dockerImageName.value.trim();
      const tag = dockerImageTag.value.trim();

      if (!path || !name) {
        dockerBuildStatus.textContent =
          "Please provide both Dockerfile path and image name";
        return;
      }

      dockerBuildStatus.textContent = "Building Docker image...";
      buildDockerBtn.disabled = true;

      fetch("/api/docker/build", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          dockerfilePath: path,
          imageName: name,
          tag: tag,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            dockerBuildStatus.textContent = data.message;
            // Refresh docker images list
            loadDockerImages();
          } else {
            dockerBuildStatus.textContent = `Error: ${data.message}`;
            console.error(data.error);
          }
        })
        .catch((error) => {
          dockerBuildStatus.textContent = `Error: ${error.message}`;
          console.error("Error building image:", error);
        })
        .finally(() => {
          buildDockerBtn.disabled = false;
        });
    });
  }

  // 3. List Docker Images
  function loadDockerImages() {
    fetch("/api/docker/images")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Clear current list
          dockerImagesTable.innerHTML = "";

          // Update container image dropdown
          containerImage.innerHTML = "";

          if (data.images && data.images.length > 0) {
            data.images.forEach((image) => {
              const tr = document.createElement("tr");
              const imageName = image.repository && image.tag
                ? `${image.repository}:${image.tag}`
                : (image.repository || image.id);
              
              tr.innerHTML = `
                <td>${image.repository || "<none>"}</td>
                <td>${image.tag || "<none>"}</td>
                <td>${image.id}</td>
                <td>${image.size}</td>
                <td>${image.created}</td>
                <td>
                  <button class="btn btn-danger btn-sm delete-image" data-id="${image.id}" data-name="${imageName}">Delete</button>
                </td>
              `;
              dockerImagesTable.appendChild(tr);

              // Add to container image dropdown
              const option = document.createElement("option");
              option.value = imageName;
              option.textContent = imageName;
              containerImage.appendChild(option);
            });
            
            // Add event listeners to delete buttons
            document.querySelectorAll(".delete-image").forEach((button) => {
              button.addEventListener("click", deleteImage);
            });
          } else {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="6">No Docker images found</td>';
            dockerImagesTable.appendChild(tr);
          }
        } else {
          console.error("Error loading Docker images:", data.message);
          document.getElementById(
            "global-status"
          ).textContent = `Error: ${data.message}`;
        }
      })
      .catch((error) => {
        console.error("Error fetching Docker images:", error);
        document.getElementById(
          "global-status"
        ).textContent = `Error: ${error.message}`;
      });
  }
  if (refreshImagesBtn) {
    refreshImagesBtn.addEventListener("click", loadDockerImages);
  }

  // 4. Create Container
  if (createContainerForm) {
    createContainerForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const image = containerImage.value;
      const name = containerName.value.trim();
      const ports = containerPorts.value.trim();
      const volumes = containerVolumes.value.trim();
      const env = containerEnv.value.trim();
      const command = containerCommand.value.trim();

      if (!image) {
        createContainerStatus.textContent = "Please select an image";
        return;
      }

      createContainerStatus.textContent = "Creating container...";
      createContainerBtn.disabled = true;

      // Parse ports, volumes, and env
      const portsList = ports ? ports.split(",").map((p) => p.trim()) : [];
      const volumesList = volumes
        ? volumes.split(",").map((v) => v.trim())
        : [];
      const envList = env ? env.split(",").map((e) => e.trim()) : [];

      fetch("/api/docker/containers/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageName: image,
          containerName: name || undefined,
          ports: portsList,
          volumes: volumesList,
          env: envList,
          command: command || undefined,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            createContainerStatus.textContent = data.message;
            // Clear form
            containerName.value = "";
            containerPorts.value = "";
            containerVolumes.value = "";
            containerEnv.value = "";
            containerCommand.value = "";
            // Refresh containers list
            loadRunningContainers();
          } else {
            createContainerStatus.textContent = `Error: ${data.message}`;
            console.error(data.error);
          }
        })
        .catch((error) => {
          createContainerStatus.textContent = `Error: ${error.message}`;
          console.error("Error creating container:", error);
        })
        .finally(() => {
          createContainerBtn.disabled = false;
        });
    });
  }

  // 5. List Running Containers
  function loadRunningContainers() {
    fetch("/api/docker/containers")
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          // Clear current list
          dockerContainersTable.innerHTML = "";

          if (data.containers && data.containers.length > 0) {
            data.containers.forEach((container) => {
              const tr = document.createElement("tr");
              tr.innerHTML = `
                                <td>${container.id}</td>
                                <td>${container.image}</td>
                                <td>${container.name}</td>
                                <td>${container.status}</td>
                                <td>${container.ports || "None"}</td>
                                <td>
                                    <button class="btn btn-danger btn-sm stop-container" data-id="${
                                      container.id
                                    }">Stop</button>
                                </td>
                            `;
              dockerContainersTable.appendChild(tr);
            });

            // Add event listeners to stop buttons
            document.querySelectorAll(".stop-container").forEach((button) => {
              button.addEventListener("click", stopContainer);
            });
          } else {
            const tr = document.createElement("tr");
            tr.innerHTML = '<td colspan="6">No running containers found</td>';
            dockerContainersTable.appendChild(tr);
          }
        } else {
          console.error("Error loading Docker containers:", data.message);
          document.getElementById(
            "global-status"
          ).textContent = `Error: ${data.message}`;
        }
      })
      .catch((error) => {
        console.error("Error fetching Docker containers:", error);
        document.getElementById(
          "global-status"
        ).textContent = `Error: ${error.message}`;
      });
  }

  if (refreshContainersBtn) {
    refreshContainersBtn.addEventListener("click", loadRunningContainers);
  }

  // 6. Stop Container
  function stopContainer(e) {
    const containerId = e.target.getAttribute("data-id");
    if (!containerId) return;

    // Disable the button
    e.target.disabled = true;
    e.target.textContent = "Stopping...";

    fetch("/api/docker/containers/stop", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        containerId: containerId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          document.getElementById("global-status").textContent = data.message;
          // Refresh container list
          loadRunningContainers();
        } else {
          document.getElementById(
            "global-status"
          ).textContent = `Error: ${data.message}`;
          console.error(data.error);
          // Reset the button
          e.target.disabled = false;
          e.target.textContent = "Stop";
        }
      })
      .catch((error) => {
        document.getElementById(
          "global-status"
        ).textContent = `Error: ${error.message}`;
        console.error("Error stopping container:", error);
        // Reset the button
        e.target.disabled = false;
        e.target.textContent = "Stop";
      });
  }
  // 7. Search Images (Local and DockerHub)
  if (searchImageBtn) {
    searchImageBtn.addEventListener("click", function () {
      const searchType = imageSearchType.value;
      const term = imageSearchTerm.value.trim();

      if (!term) {
        imageSearchStatus.textContent = "Please enter a search term";
        return;
      }

      imageSearchStatus.textContent = `Searching for ${term}...`;
      searchImageBtn.disabled = true;

      let endpoint = "";
      if (searchType === "local") {
        endpoint = "/api/docker/images/search";
        // Set up table header for local search
        imageSearchResultsHeader.innerHTML = `
                <tr>
                    <th>Repository</th>
                    <th>Tag</th>
                    <th>ID</th>
                    <th>Size</th>
                    <th>Created</th>
                </tr>
            `;
      } else {
        endpoint = "/api/docker/dockerhub/search";
        // Set up table header for DockerHub search
        imageSearchResultsHeader.innerHTML = `
                <tr>
                    <th>Name</th>
                    <th>Description</th>
                    <th>Stars</th>
                    <th>Official</th>
                    <th>Automated</th>
                    <th>Action</th>
                </tr>
            `;
      }
      console.log(`Sending search request to ${endpoint} for term: ${term}`);
      fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          searchTerm: term,
        }),
      })
        .then((response) => {
          console.log(`Received response with status: ${response.status}`);
          return response.json();
        })
        .then((data) => {
          console.log("Received data:", data);
          if (data.success) {
            imageSearchResultsTable.innerHTML = "";

            if (data.images && data.images.length > 0) {
              data.images.forEach((image) => {
                const tr = document.createElement("tr");

                if (searchType === "local") {
                  tr.innerHTML = `
                                <td>${image.repository || "<none>"}</td>
                                <td>${image.tag || "<none>"}</td>
                                <td>${image.id}</td>
                                <td>${image.size}</td>
                                <td>${image.created}</td>
                            `;
                } else {
                  tr.innerHTML = `
                                <td>${image.name || ""}</td>
                                <td>${image.description || ""}</td>
                                <td>${image.stars || 0}</td>
                                <td>${image.official ? "Yes" : "No"}</td>
                                <td>${image.automated ? "Yes" : "No"}</td>
                                <td><button class="btn btn-primary btn-sm pull-image" data-name="${
                                  image.name
                                }">Pull</button></td>
                            `;
                }

                imageSearchResultsTable.appendChild(tr);
              });

              // Add event listeners for pull buttons
              if (searchType === "dockerhub") {
                document.querySelectorAll(".pull-image").forEach((button) => {
                  button.addEventListener("click", function () {
                    const imageName = this.getAttribute("data-name");
                    pullImageName.value = imageName;
                    pullImageTag.value = "latest";

                    // Scroll to pull section
                    document
                      .getElementById("pull-image-form")
                      .scrollIntoView({ behavior: "smooth" });
                  });
                });
              }

              imageSearchStatus.textContent = `Found ${data.images.length} results`;
            } else {
              const tr = document.createElement("tr");
              const colSpan = searchType === "local" ? 5 : 6;
              tr.innerHTML = `<td colspan="${colSpan}">No images found matching '${term}'</td>`;
              imageSearchResultsTable.appendChild(tr);
              imageSearchStatus.textContent = "No results found";
            }
          } else {
            imageSearchStatus.textContent = `Error: ${
              data.message || "Unknown error"
            }`;
            console.error("Search error:", data.error);

            // Show detailed error in global status
            document.getElementById("global-status").textContent = `Error: ${
              data.message || "Unknown error during search"
            }`;
          }
        })
        .catch((error) => {
          imageSearchStatus.textContent = `Error: ${
            error.message || "Network error"
          }`;
          console.error("Error searching for images:", error);

          // Show detailed error in global status
          document.getElementById("global-status").textContent = `Error: ${
            error.message || "Network error during search"
          }`;
        })
        .finally(() => {
          searchImageBtn.disabled = false;
        });
    });
  } // 8. Pull Image
  if (pullImageForm) {
    pullImageForm.addEventListener("submit", function (e) {
      e.preventDefault();

      const name = pullImageName.value.trim();
      const tag = pullImageTag.value.trim();

      if (!name) {
        pullImageStatus.textContent = "Please enter an image name";
        return;
      }

      pullImageStatus.textContent = `Pulling image ${name}${
        tag ? ":" + tag : ""
      }...`;
      pullImageBtn.disabled = true;

      fetch("/api/docker/images/pull", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          imageName: name,
          tag: tag,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.success) {
            pullImageStatus.textContent = data.message;
            // Refresh images list
            loadDockerImages();
          } else {
            pullImageStatus.textContent = `Error: ${data.message}`;
            console.error(data.error);
          }
        })
        .catch((error) => {
          pullImageStatus.textContent = `Error: ${error.message}`;
          console.error("Error pulling image:", error);
        })
        .finally(() => {
          pullImageBtn.disabled = false;
        });
    });
  }

  // 9. Delete Docker Image
  function deleteImage(e) {
    const imageId = e.target.getAttribute("data-id");
    const imageName = e.target.getAttribute("data-name");
    
    if (!imageId) return;
    
    if (!confirm(`Are you sure you want to delete image ${imageName || imageId}?`)) {
      return;
    }

    // Disable the button
    e.target.disabled = true;
    e.target.textContent = "Deleting...";
    
    fetch("/api/docker/images/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageId: imageId,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (data.success) {
          document.getElementById("global-status").textContent = data.message;
          // Refresh images list
          loadDockerImages();
        } else {
          document.getElementById("global-status").textContent = `Error: ${data.message}`;
          console.error(data.error);
          // Reset the button
          e.target.disabled = false;
          e.target.textContent = "Delete";
        }
      })
      .catch((error) => {
        document.getElementById("global-status").textContent = `Error: ${error.message}`;
        console.error("Error deleting image:", error);
        // Reset the button
        e.target.disabled = false;
        e.target.textContent = "Delete";
      });
  }

  // Initialize lists when the component is loaded
  loadDockerImages();
  loadRunningContainers();
}
