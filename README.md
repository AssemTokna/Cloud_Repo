# Cloud Management System

A web-based platform for managing virtual machines and disk images using QEMU virtualization technology.

## Overview

The Cloud Management System provides a simple yet powerful interface for creating, managing, and running virtual machines. It offers a complete solution for disk image management and VM configuration through an intuitive web interface.

## Features

### Virtual Disk Management

- Create disk images in multiple formats (QCOW2, Raw)
- Specify disk size and name
- List all available disk images
- Delete existing disk images

### Virtual Machine Management

- Create and configure virtual machines
- Specify CPU cores and memory allocation
- Select existing disk images for VM storage
- Optional ISO boot support
- Save and load VM configurations

## System Requirements

### Prerequisites

- QEMU virtualization tools must be installed
    - Required for disk creation and VM operations
    - The system will check for QEMU availability and provide installation guidance if not found

## Installation

1. Clone the repository
2. Install dependencies
3. Configure the application directories
4. Start the web server

## Usage

### Disk Management

The system allows you to create and manage virtual disk images:

1. Navigate to the "Virtual Disks" tab
2. Create a new disk by:
    - Selecting disk type (QCOW2 or Raw)
    - Specifying size in GB
    - Providing a name
3. Manage existing disks:
    - View all available disk images
    - Delete selected disks when no longer needed index.html:24-28

### VM Creation

Create and configure virtual machines:

1. Navigate to the "Create VM" tab
2. Configure VM parameters:
    - VM name
    - CPU cores
    - Memory allocation
    - Select a disk image
    - Optionally specify a boot ISO
3. Save VM configuration for later use or create and start the VM immediately index.html:58-62

## Architecture

The application follows a client-server architecture:

- **Frontend**: Web-based UI for user interaction
- **Backend**: API endpoints for disk and VM operations
- **Storage**: Local storage for disk images and VM configurations


## Troubleshooting

### QEMU Not Found

If the system cannot find QEMU utilities:

- Ensure QEMU is installed on your system
- Verify QEMU binaries are in your system PATH
- On Windows, check common installation locations

### Disk Creation Failure

If disk creation fails:

- Check disk permissions in the storage directory
- Verify enough free space is available
- Ensure the disk name doesn't contain invalid characters
