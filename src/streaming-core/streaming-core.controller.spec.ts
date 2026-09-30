import { StreamingCoreController } from "./streaming-core.controller";
import { StreamableFile } from "@nestjs/common";
import { NotFoundException, BadRequestException } from "@nestjs/common";

describe("StreamingCoreController", () => {
  const mockStreamingCoreService = {
    getInstance: jest.fn(),
  };
  const controller = new StreamingCoreController(mockStreamingCoreService as any);

  const mockResponse = () => ({
    set: jest.fn(),
    setHeader: jest.fn(),
    status: jest.fn().mockReturnThis(),
  });

  const mockRequest = () => ({
    protocol: "http",
    get: jest.fn((name: string) => (name === "host" ? "localhost:3000" : undefined)),
  });

  const mockStream = Buffer.from("test");

  class MockStreamInstance {
    type = "stream";
    async getMetadata() {
      return { mimeType: "audio/mpeg", size: 1000 };
    }
    getStream() {
      return mockStream;
    }
    getPart(start: number, end: number) {
      return mockStream.slice(start, end + 1);
    }
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("instantiates", () => {
    expect(controller).toBeDefined();
  });

  describe("getStream", () => {
    it("returns full stream when no range", async () => {
      const instance = new MockStreamInstance();
      mockStreamingCoreService.getInstance.mockReturnValue(instance);
      const res: any = mockResponse();
      const result = await controller.getStream("id1", undefined, res);

      expect(instance.getMetadata).toBeDefined();
      expect(res.set).toHaveBeenCalledWith({
        "Content-Type": "audio/mpeg",
        "Content-Length": 1000,
        "Accept-Ranges": "bytes",
      });
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it("returns partial content for valid range", async () => {
      const instance = new MockStreamInstance();
      mockStreamingCoreService.getInstance.mockReturnValue(instance);
      const res: any = mockResponse();
      const result = await controller.getStream("id1", "bytes=0-499", res);

      expect(res.status).toHaveBeenCalledWith(206);
      expect(res.set).toHaveBeenCalledWith({
        "Content-Range": "bytes 0-499/1000",
        "Accept-Ranges": "bytes",
        "Content-Length": 500,
        "Content-Type": "audio/mpeg",
      });
      expect(result).toEqual(instance.getPart(0, 499));
    });

    it("returns 416 for out of bounds range", async () => {
      const instance = new MockStreamInstance();
      mockStreamingCoreService.getInstance.mockReturnValue(instance);
      const res: any = mockResponse();
      await controller.getStream("id1", "bytes=1000-1500", res);

      expect(res.status).toHaveBeenCalledWith(416);
      expect(res.set).toHaveBeenCalledWith("Content-Range", "bytes */1000");
    });
  });

  describe("getHLSPlaylist", () => {
    it("returns playlist string", async () => {
      const instance = {
        id: "id1",
        type: "hls",
        getPlaylist: jest.fn().mockResolvedValue("#EXTM3U\n#EXT-X-ENDLIST"),
      };
      mockStreamingCoreService.getInstance.mockReturnValue(instance as any);
      const result = await controller.getHLSPlaylist("id1", mockRequest() as any);
      expect(result).toBe("#EXTM3U\n#EXT-X-ENDLIST");
      expect(instance.getPlaylist).toHaveBeenCalledWith(
        "http://localhost:3000/streaming/id1/hls/segment",
      );
    });
  });

  describe("getHLSSegment", () => {
    it("returns segment file", async () => {
      const segmentBuffer = Buffer.from("segment");
      const instance = {
        type: "hls",
        getSegment: jest.fn().mockResolvedValue(segmentBuffer),
        getMimeType: jest.fn().mockReturnValue("video/mp4"),
      };
      mockStreamingCoreService.getInstance.mockReturnValue(instance as any);
      const res: any = mockResponse();
      const result = await controller.getHLSSegment("id1", "seg1", res);
      expect(instance.getSegment).toHaveBeenCalledWith("seg1");
      expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "video/mp4");
      expect(result).toBeInstanceOf(StreamableFile);
    });

    it("throws NotFoundException when segment missing", async () => {
      const instance = {
        type: "hls",
        getSegment: jest.fn().mockResolvedValue(null),
      };
      mockStreamingCoreService.getInstance.mockReturnValue(instance as any);
      const res: any = mockResponse();
      await expect(
        controller.getHLSSegment("id1", "seg1", res),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

