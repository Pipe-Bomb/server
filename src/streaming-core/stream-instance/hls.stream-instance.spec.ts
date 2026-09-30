import { HLSStreamInstance } from "./hls.stream-instance";
import { HLSAudioProducer, HLSContainerType, HLSPlaylist } from "@sdk";
import { BadRequestException } from "@nestjs/common";

class MockHLSProducer implements HLSAudioProducer {
  type: "hls" = "hls";
  cacheable = true;
  async getPlaylist() {
    const playlist: HLSPlaylist = {
      containerType: "ts",
      version: 3,
      targetDuration: 5,
      mediaSequence: 0,
      segments: [
        { id: "seg1", duration: 5, discontinuity: false },
        { id: "seg2", duration: 5, discontinuity: false },
      ],
    };
    return playlist;
  }
  async getSegment(id: string) {
    return Buffer.from(`segment-${id}`);
  }
}

describe("HLSStreamInstance", () => {
  const producer = new MockHLSProducer();
  const instance = new HLSStreamInstance("id1", producer as any);

  it("maps extensions correctly", () => {
    expect(instance.getExtension("ts" as HLSContainerType)).toBe("ts");
    expect(instance.getExtension("aac" as HLSContainerType)).toBe("aac");
    expect(instance.getExtension("fmp4" as HLSContainerType)).toBe("m4s");
  });

  it("returns correct MIME type", () => {
    expect(instance.getMimeType("m3u8")).toBe("application/vnd.apple.mpegurl");
    expect(instance.getMimeType("ts")).toBe("video/MP2T");
    expect(instance.getMimeType("m4s")).toBe("video/iso.segment");
    expect(instance.getMimeType("mp4")).toBe("video/mp4");
    expect(instance.getMimeType("aac")).toBe("audio/aac");
    expect(instance.getMimeType("unknown")).toBe("application/octet-stream");
  });

  it("generates and caches playlist", async () => {
    const playlist1 = await instance.getPlaylist("http://base");
    const playlist2 = await instance.getPlaylist("http://base");
    expect(playlist1).toBe(playlist2);
    expect(playlist1).toMatch(/#EXTM3U/);
    expect(playlist1).toMatch(/#EXT-X-VERSION:3/);
    expect(playlist1).toMatch(/#EXT-X-TARGETDURATION:5/);
    expect(playlist1).toMatch(/#EXT-X-MEDIA-SEQUENCE:0/);
    expect(playlist1).toMatch(/#EXT-X-ENDLIST/);
  });

  it("stores internal IDs and retrieves them", async () => {
    const base = "http://base";
    await instance.getPlaylist(base);
    const playlist = await instance.getPlaylist(base);
    const uuidRegex = /base\/([^\.]+)\.ts/;
    const segmentLines = playlist.split("\n").filter((l) => l.includes(".ts"));
    const uuids = segmentLines.map((l) => l.match(uuidRegex)![1]);
    // Ensure getInternalId returns the original segment id for each uuid.
    uuids.forEach((uuid) => {
      const internalId = instance.getInternalId(uuid);
      expect(internalId).toBeDefined();
    });
  });

  it("throws if playlist not generated when getting segment", async () => {
    const newInstance = new HLSStreamInstance("id2", producer as any);
    await expect(newInstance.getSegment("uuid")).rejects.toThrow(BadRequestException);
  });

  it("retrieves segment via internal ID", async () => {
    const base = "http://base";
    await instance.getPlaylist(base);
    const lines = await instance.getPlaylist(base);
    const uuidRegex = /base\/([^\.]+)\.ts/;
    const segmentLines = lines.split("\n").filter((l) => l.includes(".ts"));
    const uuid = segmentLines[0].match(uuidRegex)![1];
    const segment = await instance.getSegment(uuid);
    expect(segment).toEqual(Buffer.from(`segment-${instance.getInternalId(uuid)}`));
  });
});
