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
    });
  });
});
