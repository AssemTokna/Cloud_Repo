const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

/**
 * Docker controller for managing Docker images and containers
 */
const dockerController = {
  /**
   * Create a Dockerfile
   */
  createDockerfile: (req, res) => {
    try {
      const { dockerfilePath, content } = req.body;

      if (!dockerfilePath || !content) {
        return res.status(400).json({
          success: false,
          message: "Dockerfile path and content are required",
        });
      }

      // Create directory if it doesn't exist
      const dirPath = path.dirname(dockerfilePath);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      // Write content to Dockerfile
      fs.writeFileSync(dockerfilePath, content);

      res.json({
        success: true,
        message: `Dockerfile created at ${dockerfilePath}`,
      });
    } catch (error) {
      console.error("Error creating Dockerfile:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create Dockerfile",
        error: error.toString(),
      });
    }
  },

  /**
   * Build a Docker image from a Dockerfile
   */
  buildImage: (req, res) => {
    try {
      const { dockerfilePath, imageName, tag } = req.body;

      if (!dockerfilePath || !imageName) {
        return res.status(400).json({
          success: false,
          message: "Dockerfile path and image name are required",
        });
      }

      const imageTag = tag || "latest";
      const fullImageName = `${imageName}:${imageTag}`;

      // Get the directory containing the Dockerfile
      const dockerfileDir = path.dirname(dockerfilePath);

      // Check if Dockerfile exists
      if (!fs.existsSync(dockerfilePath)) {
        return res.status(404).json({
          success: false,
          message: "Dockerfile not found at specified path",
        });
      }

      // Execute docker build command
      const command = `docker build -t ${fullImageName} -f "${dockerfilePath}" "${dockerfileDir}"`;
      const output = execSync(command).toString();

      res.json({
        success: true,
        message: `Docker image ${fullImageName} built successfully`,
        output,
      });
    } catch (error) {
      console.error("Error building Docker image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to build Docker image",
        error: error.toString(),
      });
    }
  },

  /**
   * List all Docker images on the system
   */
  listImages: (req, res) => {
    try {
      const output = execSync(
        'docker image ls --format "{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}} {{.CreatedSince}}"'
      ).toString();
      const images = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [repoTag, id, size, created] = line.split(" ");
          const [repo, tag] = repoTag.split(":");
          return {
            repository: repo,
            tag: tag || "latest",
            id,
            size,
            created,
          };
        });

      res.json({
        success: true,
        images,
      });
    } catch (error) {
      console.error("Error listing Docker images:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list Docker images",
        error: error.toString(),
      });
    }
  },

  /**
   * Create a Docker container from an image
   */
  createContainer: (req, res) => {
    try {
      const {
        imageName,
        containerName,
        ports,
        volumes,
        env,
        command: containerCommand,
      } = req.body;

      if (!imageName) {
        return res.status(400).json({
          success: false,
          message: "Image name is required",
        });
      }

      // Build the docker run command
      let command = `docker run -d`;

      // Add container name if specified
      if (containerName) {
        command += ` --name "${containerName}"`;
      }

      // Add port mappings if specified
      if (ports && ports.length > 0) {
        for (const port of ports) {
          command += ` -p ${port}`;
        }
      }

      // Add volume mappings if specified
      if (volumes && volumes.length > 0) {
        for (const volume of volumes) {
          command += ` -v ${volume}`;
        }
      }

      // Add environment variables if specified
      if (env && env.length > 0) {
        for (const envVar of env) {
          command += ` -e ${envVar}`;
        }
      }

      // Add the image name
      command += ` ${imageName}`;

      // Add container command if specified
      if (containerCommand) {
        command += ` ${containerCommand}`;
      }

      // Run the docker command
      const output = execSync(command).toString();

      res.json({
        success: true,
        message: "Container created and started successfully",
        containerId: output.trim(),
      });
    } catch (error) {
      console.error("Error creating Docker container:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create Docker container",
        error: error.toString(),
      });
    }
  },

  /**
   * List all running Docker containers
   */
  listRunningContainers: (req, res) => {
    try {
      const output = execSync(
        'docker ps --format "{{.ID}} {{.Image}} {{.Names}} {{.Status}} {{.Ports}}"'
      ).toString();
      const containers = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          // We need to be more careful with parsing the output since ports, status may contain spaces
          const parts = line.split(" ");
          const id = parts[0];

          // Extract name - it's the third element in the docker ps output
          let name = parts[2];

          // Extract image - it's the second element
          let image = parts[1];

          // Status and ports might contain spaces, so we need to reconstruct the rest
          const rest = parts.slice(3).join(" ");

          // Try to extract status and ports based on common patterns
          let status = "";
          let ports = "";

          // Status typically starts with "Up" or "Exited"
          if (rest.includes("Up") || rest.includes("Exited")) {
            // Ports are typically listed after "->" or they don't exist
            const portIndex = rest.indexOf("->");
            if (portIndex !== -1) {
              status = rest.substring(0, portIndex).trim();
              ports = rest.substring(portIndex).trim();
            } else {
              status = rest.trim();
            }
          } else {
            status = rest;
          }

          return {
            id,
            image,
            name,
            status,
            ports,
          };
        });

      res.json({
        success: true,
        containers,
      });
    } catch (error) {
      console.error("Error listing Docker containers:", error);
      res.status(500).json({
        success: false,
        message: "Failed to list Docker containers",
        error: error.toString(),
      });
    }
  },

  /**
   * Stop a Docker container
   */
  stopContainer: (req, res) => {
    try {
      const { containerId } = req.body;

      if (!containerId) {
        return res.status(400).json({
          success: false,
          message: "Container ID is required",
        });
      }

      execSync(`docker stop ${containerId}`);

      res.json({
        success: true,
        message: `Container ${containerId} stopped successfully`,
      });
    } catch (error) {
      console.error("Error stopping Docker container:", error);
      res.status(500).json({
        success: false,
        message: "Failed to stop Docker container",
        error: error.toString(),
      });
    }
  },

  /**
   * Search for Docker images locally
   */
  searchLocalImage: (req, res) => {
    try {
      const { searchTerm } = req.body;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: "Search term is required",
        });
      }

      // In Windows PowerShell, we need a different approach than grep
      let command;
      if (os.platform() === "win32") {
        command = `docker image ls | findstr /I "${searchTerm}"`;
      } else {
        command = `docker image ls | grep -i "${searchTerm}"`;
      }

      const output = execSync(command).toString();

      // Parse output manually since the format may differ on different platforms
      const images = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          // Split by whitespace but preserve headers
          const parts = line.trim().split(/\s+/);
          if (parts.length >= 5) {
            const repository = parts[0];
            const tag = parts[1];
            const id = parts[2];
            const created = parts[3] + " " + parts[4];
            const size = parts[parts.length - 1];

            return {
              repository,
              tag,
              id,
              created,
              size,
            };
          }
          return null;
        })
        .filter(Boolean);

      res.json({
        success: true,
        images,
      });
    } catch (error) {
      // If findstr/grep doesn't find anything, it returns non-zero exit code
      if (
        error.status === 1 ||
        error.message.includes("no matching entries found")
      ) {
        return res.json({
          success: true,
          images: [],
        });
      }

      console.error("Error searching Docker images:", error);
      res.status(500).json({
        success: false,
        message: "Failed to search Docker images",
        error: error.toString(),
      });
    }
  },

  /**
   * Delete a Docker image
   */
  deleteImage: (req, res) => {
    try {
      const { imageId } = req.body;

      if (!imageId) {
        return res.status(400).json({
          success: false,
          message: "Image ID is required",
        });
      }

      // Execute docker rmi command
      const output = execSync(`docker rmi ${imageId} --force`).toString();

      res.json({
        success: true,
        message: `Docker image deleted successfully`,
        output,
      });
    } catch (error) {
      console.error("Error deleting Docker image:", error);

      // Extract error message from Docker CLI
      let errorMessage = "Failed to delete Docker image";
      if (error.stderr) {
        const stderrStr = error.stderr.toString();
        errorMessage = stderrStr.split("\n")[0] || errorMessage;
      }

      res.status(500).json({
        success: false,
        message: errorMessage,
        error: error.toString(),
      });
    }
  },

  /**
   * Search for Docker images on DockerHub
   */
  searchDockerHub: (req, res) => {
    // Try using execSync to simplify error handling
    const { searchTerm } = req.body;

    if (!searchTerm) {
      return res.status(400).json({
        success: false,
        message: "Search term is required",
      });
    }

    console.log(`Searching DockerHub for: ${searchTerm}`);

    try {
      // Use execSync which is more reliable for this purpose
      const output = execSync(`docker search ${searchTerm}`, {
        encoding: "utf8",
        stdio: ["pipe", "pipe", "pipe"],
      });

      // Parse the table output
      const lines = output.trim().split("\n");
      const images = [];

      // Skip the header row
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        try {
          const columns = line.split(/\s{2,}/); // Split by 2+ spaces

          if (columns.length >= 3) {
            const name = columns[0].trim();
            let description = "";
            let stars = 0;
            let official = false;
            let automated = false;

            // Handle different columns based on Docker version
            if (columns.length >= 5) {
              // Newer Docker versions have NAME, DESCRIPTION, STARS, OFFICIAL, AUTOMATED
              description = columns[1].trim();
              stars = parseInt(columns[2]) || 0;
              official = columns[3] && columns[3].includes("[OK]");
              automated = columns[4] && columns[4].includes("[OK]");
            } else if (columns.length >= 3) {
              // Older versions might have fewer columns
              description = columns[1].trim();
              stars = parseInt(columns[2]) || 0;
            }

            images.push({
              name,
              description,
              stars,
              official,
              automated,
            });
          }
        } catch (err) {
          console.error(`Error parsing line: "${line}"`, err);
          // Continue with next line
        }
      }

      console.log(`Found ${images.length} images from DockerHub`);

      return res.json({
        success: true,
        images,
      });
    } catch (error) {
      console.error("Error executing docker search:", error);

      // If no results found or command fails due to no matching entries
      if (
        error.status === 1 ||
        (error.message &&
          (error.message.includes("No such image") ||
            error.message.includes("no matching entries")))
      ) {
        return res.json({
          success: true,
          images: [],
        });
      }

      return res.status(500).json({
        success: false,
        message: "Failed to search DockerHub: " + error.message,
        error: error.toString(),
      });
    }
  },

  /**
   * Pull a Docker image from DockerHub
   */
  pullImage: (req, res) => {
    try {
      const { imageName, tag } = req.body;

      if (!imageName) {
        return res.status(400).json({
          success: false,
          message: "Image name is required",
        });
      }

      const imageTag = tag || "latest";
      const fullImageName = `${imageName}:${imageTag}`;

      // Pull the image
      const output = execSync(`docker pull ${fullImageName}`).toString();

      res.json({
        success: true,
        message: `Image ${fullImageName} pulled successfully`,
        output,
      });
    } catch (error) {
      console.error("Error pulling Docker image:", error);
      res.status(500).json({
        success: false,
        message: "Failed to pull Docker image",
        error: error.toString(),
      });
    }
  },
};

module.exports = dockerController;
