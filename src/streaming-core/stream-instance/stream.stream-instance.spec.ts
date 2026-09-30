import { StreamStreamInstance } from "./stream.stream-instance";
import { StreamAudioProducer } from "@sdk";

class MockProducer implements StreamAudioProducer {
  type: "stream" = "stream";
  cacheable = true;
  async getMetadata() {
    return { mimeType: "audio/mpeg", size: 1000 };
  }
  getStream() {
    return Buffer.from("stream data");
  }
  getPart(start: number, end: number) {
    return Buffer.from("part data").slice(start, end + 1);
  }
}

describe("StreamStreamInstance", () => {
  const producer = new MockProducer();
  const instance = new StreamStreamInstance("id1", producer as any);

  it("caches metadata", async () => {
    const spy = jest.spyOn(producer, "getMetadata");
    const m1 = await instance.getMetadata();
    const m2 = await instance.getMetadata();
    expect(m1).toEqual(m2);
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("forwards getStream", () => {
    const res = instance.getStream();
    expect(res).toEqual(Buffer.from("stream data"));
  });

  it("forwards getPart", () => {
    const res = instance.getPart(0, 5);
    expect(res).toEqual(Buffer.from("part d"));
  });
});
