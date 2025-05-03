const path = require("path");
const fs = require("fs");
const diskController = require("../controllers/disk-controller");

// Mock dependencies
jest.mock("fs");
jest.mock("child_process");
jest.mock("os");

describe("Disk Controller", () => {
  const mockAppDirs = {
    disks: "/mock/disks/path",
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe("listDisks", () => {
    it("should return list of disks", () => {
      // Mock fs.readdirSync to return test data
      fs.readdirSync.mockReturnValue([
        "disk1.qcow2",
        "disk2.raw",
        "notadisk.txt",
      ]);

      const mockRes = {
        json: jest.fn(),
      };

      diskController.listDisks({}, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        disks: ["disk1.qcow2", "disk2.raw"],
      });
    });

    it("should handle errors when listing disks", () => {
      fs.readdirSync.mockImplementation(() => {
        throw new Error("Test error");
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      diskController.listDisks({}, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Test error",
      });
    });
  });

  describe("createDisk", () => {
    it("should create a new disk successfully", () => {
      const mockReq = {
        body: {
          type: "qcow2",
          size: 10,
          name: "testdisk",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      fs.existsSync.mockReturnValue(false);

      diskController.createDisk(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        diskName: "testdisk.qcow2",
        message: expect.any(String),
      });
    });

    it("should handle existing disk error", () => {
      const mockReq = {
        body: {
          type: "qcow2",
          size: 10,
          name: "testdisk",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      fs.existsSync.mockReturnValue(true);

      diskController.createDisk(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Disk already exists.",
      });
    });
  });

  describe("deleteDisk", () => {
    it("should delete disk successfully", () => {
      const mockReq = {
        params: {
          name: "testdisk.qcow2",
        },
      };

      const mockRes = {
        json: jest.fn(),
      };

      fs.existsSync.mockReturnValue(true);
      fs.unlinkSync.mockImplementation(() => {});

      diskController.deleteDisk(mockReq, mockRes, mockAppDirs);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: expect.any(String),
      });
    });

    it("should handle non-existent disk error", () => {
      const mockReq = {
        params: {
          name: "nonexistent.qcow2",
        },
      };

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      fs.existsSync.mockReturnValue(false);

      diskController.deleteDisk(mockReq, mockRes, mockAppDirs);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Disk not found.",
      });
    });
  });
});
