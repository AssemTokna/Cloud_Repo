const path = require("path");
const fs = require("fs");
const vmController = require("../controllers/vm-controller");
const { exec, execSync } = require("child_process");

// Mock dependencies
jest.mock("fs");
jest.mock("child_process");
jest.mock("os", () => ({
  platform: jest.fn().mockReturnValue("win32"),
}));

describe("VM Controller", () => {
  const mockAppDirs = {
    disks: "/mock/disks/path",
    vms: "/mock/vms/path",
    iso: "/mock/iso/path",
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Reset running VMs tracking
    Object.keys(vmController.runningVMs).forEach(
      (key) => delete vmController.runningVMs[key]
    );

    // Mock successful execSync for QEMU checks and other commands
    execSync.mockImplementation((cmd) => {
      if (
        cmd.includes("where qemu-system-x86_64") ||
        cmd.includes("which qemu-system-x86_64")
      ) {
        return "C:\\qemu\\qemu-system-x86_64.exe"; // Fake path for QEMU
      }

      if (cmd.includes("tasklist") || cmd.includes("ps -")) {
        return "QEMU Process,1234\nQEMU Process,5678"; // Fake process list
      }

      if (cmd.includes("wmic process")) {
        return "CommandLine=-name testvm"; // For getVMNameFromPID
      }

      if (cmd.includes("taskkill") || cmd.includes("kill")) {
        return ""; // Success for kill commands
      }

      return "";
    });
  });

  describe("listRunningVMs", () => {
    it("should return list of running VMs", () => {
      const mockRes = {
        json: jest.fn(),
      };

      vmController.listRunningVMs({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        vms: expect.any(Array),
      });
    });

    it("should handle errors when listing VMs", () => {
      execSync.mockImplementation(() => {
        throw new Error("Test error");
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      vmController.listRunningVMs({}, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });

    it("should handle Linux system commands", () => {
      // Mock OS as Linux
      const platform = require("os").platform;
      platform.mockReturnValueOnce("linux");

      const mockRes = {
        json: jest.fn(),
      };

      vmController.listRunningVMs({}, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        vms: expect.any(Array),
      });
    });
  });

  describe("createVM", () => {
    it("should create and start a new VM", () => {
      const mockReq = {
        body: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      fs.existsSync.mockReturnValue(true);
      exec.mockReturnValue({ pid: 1234 });

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String),
        pid: expect.any(Number),
      });
    });

    it("should handle missing disk error", () => {
      const mockReq = {
        body: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "nonexistent.qcow2",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock the disk does not exist
      fs.existsSync.mockImplementation((path) => {
        return false; // Disk doesn't exist
      });

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });

    it("should return error when QEMU is not available", () => {
      const mockReq = {
        body: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Mock QEMU check failure
      execSync.mockImplementation((cmd) => {
        if (cmd.includes("where qemu-system-x86_64")) {
          throw new Error("QEMU not found");
        }
        return "";
      });

      fs.existsSync.mockReturnValue(false); // Also make sure no paths are found

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });

    it("should handle missing VM name", () => {
      const mockReq = {
        body: {
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });

    it("should handle missing disk selection", () => {
      const mockReq = {
        body: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });

    it("should create VM with ISO when specified", () => {
      const mockReq = {
        body: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
          iso: "/path/to/iso.iso",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      fs.existsSync.mockReturnValue(true);
      exec.mockReturnValue({ pid: 1234 });

      vmController.createVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          pid: expect.any(Number),
        })
      );
    });
  });

  describe("stopVM", () => {
    it("should stop a running VM by name", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      // Setup a mock running VM
      vmController.runningVMs["testvm"] = { pid: 1234 };

      vmController.stopVM(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String),
      });
      expect(vmController.runningVMs["testvm"]).toBeUndefined();
    });

    it("should stop a running VM by PID", () => {
      const mockReq = {
        body: {
          pid: "1234",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      vmController.stopVM(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining("1234"),
      });
    });

    it("should stop all VMs when no name or PID is provided", () => {
      const mockReq = {
        body: {},
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      vmController.stopVM(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining("all"),
      });
    });

    it("should handle errors when stopping VM", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Setup a mock running VM
      vmController.runningVMs["testvm"] = { pid: 1234 };

      // Mock execSync to throw error
      execSync.mockImplementation(() => {
        throw new Error("Failed to stop VM");
      });

      vmController.stopVM(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe("VM Configuration Management", () => {
    const mockVMConfigs = {
      testvm: {
        name: "testvm",
        cpu: 2,
        memory: 1024,
        disk: "testdisk.qcow2",
      },
    };

    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));
    });

    describe("listVMConfigs", () => {
      it("should return list of VM configurations", () => {
        const mockRes = {
          json: jest.fn(),
        };

        vmController.listVMConfigs({}, mockRes, mockAppDirs);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          configs: ["testvm"],
        });
      });

      it("should handle case when no configs exist", () => {
        const mockRes = {
          json: jest.fn(),
        };

        fs.existsSync.mockReturnValue(false);

        vmController.listVMConfigs({}, mockRes, mockAppDirs);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          configs: [],
        });
      });

      it("should handle errors", () => {
        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        fs.existsSync.mockImplementation(() => {
          throw new Error("File system error");
        });

        vmController.listVMConfigs({}, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.any(String),
        });
      });
    });

    describe("getVMConfig", () => {
      it("should return specific VM configuration", () => {
        const mockReq = {
          params: {
            name: "testvm",
          },
        };

        const mockRes = {
          json: jest.fn(),
        };

        vmController.getVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          config: mockVMConfigs["testvm"],
        });
      });

      it("should handle config file not found", () => {
        const mockReq = {
          params: {
            name: "testvm",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        fs.existsSync.mockReturnValue(false);

        vmController.getVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("No VM configurations found"),
        });
      });

      it("should handle specific VM config not found", () => {
        const mockReq = {
          params: {
            name: "nonexistentvm",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        vmController.getVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("not found"),
        });
      });
    });

    describe("saveVMConfig", () => {
      it("should save VM configuration", () => {
        const mockReq = {
          body: {
            name: "newvm",
            cpu: 4,
            memory: 2048,
            disk: "newdisk.qcow2",
          },
        };

        const mockRes = {
          json: jest.fn(),
        };

        vmController.saveVMConfig(mockReq, mockRes, mockAppDirs);

        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: expect.any(String),
        });
      });

      it("should handle missing name error", () => {
        const mockReq = {
          body: {
            cpu: 4,
            memory: 2048,
            disk: "newdisk.qcow2",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        vmController.saveVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("name"),
        });
      });

      it("should handle write errors", () => {
        const mockReq = {
          body: {
            name: "newvm",
            cpu: 4,
            memory: 2048,
            disk: "newdisk.qcow2",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        fs.writeFileSync.mockImplementation(() => {
          throw new Error("Write error");
        });

        vmController.saveVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.any(String),
        });
      });
    });

    describe("deleteVMConfig", () => {
      it("should delete VM configuration", () => {
        const mockReq = {
          params: {
            name: "testvm",
          },
        };

        const mockRes = {
          json: jest.fn(),
          status: jest.fn().mockReturnThis() 
        };
        
        // Make sure fs.writeFileSync doesn't throw an error in this test
        fs.writeFileSync.mockImplementation(() => undefined);

        vmController.deleteVMConfig(mockReq, mockRes, mockAppDirs);

        expect(fs.writeFileSync).toHaveBeenCalled();
        expect(mockRes.json).toHaveBeenCalledWith({
          success: true,
          message: expect.stringContaining("deleted"),
        });
      });

      it("should handle config file not found", () => {
        const mockReq = {
          params: {
            name: "testvm",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        fs.existsSync.mockReturnValue(false);

        vmController.deleteVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("No VM configurations found"),
        });
      });

      it("should handle VM configuration not found", () => {
        const mockReq = {
          params: {
            name: "nonexistentvm",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        vmController.deleteVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.stringContaining("not found"),
        });
      });

      it("should handle write errors", () => {
        const mockReq = {
          params: {
            name: "testvm",
          },
        };

        const mockRes = {
          status: jest.fn().mockReturnThis(),
          json: jest.fn(),
        };

        fs.writeFileSync.mockImplementation(() => {
          throw new Error("Write error");
        });

        vmController.deleteVMConfig(mockReq, mockRes, mockAppDirs);

        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith({
          success: false,
          message: expect.any(String),
        });
      });
    });
  });

  describe("startVM", () => {
    it("should start a VM from saved configuration", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      const mockVMConfigs = {
        testvm: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));
      exec.mockReturnValue({ pid: 1234 });

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.stringContaining("testvm"),
        pid: 1234,
      });
      expect(vmController.runningVMs["testvm"]).toBeDefined();
    });

    it("should handle when VM is already running", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      // Setup VM as already running
      vmController.runningVMs["testvm"] = { pid: 1234 };

      // Mock process check to return true
      execSync.mockImplementation((cmd) => {
        if (cmd.includes("tasklist /FI")) {
          return '"QEMU","1234"';
        }
        return "";
      });

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("already running"),
      });
    });

    it("should handle VM with stale entry", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      const mockVMConfigs = {
        testvm: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      // Setup VM with stale entry
      vmController.runningVMs["testvm"] = { pid: 9999 };

      // Mock process check to return false (process doesn't exist)
      execSync.mockImplementation((cmd) => {
        if (cmd.includes("tasklist /FI")) {
          return ""; // No process found
        }
        if (cmd.includes("where") || cmd.includes("which")) {
          return "C:\\qemu\\qemu-system-x86_64.exe";
        }
        return "";
      });

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));
      exec.mockReturnValue({ pid: 1234 });

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(vmController.runningVMs["testvm"].pid).toBe(1234);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String),
        pid: 1234,
      });
    });

    it("should handle config file not found", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      fs.existsSync.mockReturnValue(false);

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("No VM configurations found"),
      });
    });

    it("should handle VM configuration not found", () => {
      const mockReq = {
        body: {
          name: "nonexistentvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockVMConfigs = {
        testvm: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("not found"),
      });
    });

    it("should handle disk not found error", () => {
      const mockReq = {
        body: {
          name: "testvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      const mockVMConfigs = {
        testvm: {
          name: "testvm",
          cpu: 2,
          memory: 1024,
          disk: "nonexistentdisk.qcow2",
        },
      };

      fs.existsSync.mockImplementation((path) => {
        // VM config exists but disk doesn't
        return !path.includes("nonexistentdisk.qcow2");
      });

      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));

      vmController.startVM(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.stringContaining("Disk"),
      });
    });
  });

  describe("getVMDetails", () => {
    it("should return details for a running VM by name", () => {
      const mockReq = {
        query: {
          name: "testvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      // Setup VM as running
      vmController.runningVMs["testvm"] = {
        pid: 1234,
        config: {
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
          iso: "/path/to/iso.iso",
          started: "2025-05-03 10:00:00",
        },
      };

      vmController.getVMDetails(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        details: expect.stringContaining("testvm"),
      });
      expect(mockRes.json.mock.calls[0][0].details).toContain("1234");
      expect(mockRes.json.mock.calls[0][0].details).toContain("testdisk.qcow2");
    });

    it("should return details for a VM by PID", () => {
      const mockReq = {
        query: {
          pid: "1234",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      // Setup VM
      vmController.runningVMs["testvm"] = {
        pid: 1234,
        config: {
          cpu: 2,
          memory: 1024,
          disk: "testdisk.qcow2",
        },
      };

      vmController.getVMDetails(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        details: expect.stringContaining("1234"),
      });
    });

    it("should look up VM config from file if not running", () => {
      const mockReq = {
        query: {
          name: "testvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      const mockVMConfigs = {
        testvm: {
          name: "testvm",
          cpu: 4,
          memory: 2048,
          disk: "testdisk.qcow2",
        },
      };

      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify(mockVMConfigs));

      vmController.getVMDetails(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        details: expect.stringContaining("testvm"),
      });
      expect(mockRes.json.mock.calls[0][0].details).toContain("4"); // CPU cores
    });

    it("should handle VM not found", () => {
      const mockReq = {
        query: {
          name: "nonexistentvm",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      // Empty configs
      fs.existsSync.mockReturnValue(true);
      fs.readFileSync.mockReturnValue(JSON.stringify({}));

      vmController.getVMDetails(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        details: expect.stringContaining("No saved configuration"),
      });
    });

    it("should handle errors", () => {
      const mockReq = {
        query: {
          name: "testvm",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      fs.existsSync.mockImplementation(() => {
        throw new Error("File system error");
      });

      vmController.getVMDetails(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: expect.any(String),
      });
    });
  });

  describe("Helper Functions", () => {
    describe("getVMNameFromPID", () => {
      // Now using the properly exported function
      beforeEach(() => {
        // Reset running VMs tracking before each test
        Object.keys(vmController.runningVMs).forEach(
          (key) => delete vmController.runningVMs[key]
        );

        // Setup mock VM
        vmController.runningVMs["testvm"] = { pid: 1234 };
      });

      it("should get VM name from running VMs object", () => {
        // Using the exported function
        const vmName = vmController.getVMNameFromPID(1234);
        
        expect(vmName).toBe("testvm");
      });

      // Testing this implementation is more complex and may not be necessary
      // as it's already indirectly tested through the other tests
    });
  });
});
