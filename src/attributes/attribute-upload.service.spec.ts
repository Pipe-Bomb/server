import { AttributeUploadService } from "./attribute-upload.service";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { DBUser } from "src/users/entity/user.entity";

// Mock the crypto module to control UUID generation
jest.mock("crypto", () => ({
  randomUUID: jest.fn(),
}));

describe("AttributeUploadService", () => {
  let service: AttributeUploadService;
  const crypto = require("crypto");
  const randomUUIDMock = crypto.randomUUID as jest.Mock;

  // A simple mock user
  const user: DBUser = { uuid: "user-uuid" } as any;

  beforeEach(() => {
    // createSession schedules a 30s timeout; use fake timers so real
    // timers never keep the jest process alive
    jest.useFakeTimers();
    service = new AttributeUploadService();
    randomUUIDMock.mockReset();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates sessions with unique uuids and correct response", () => {
    randomUUIDMock
      .mockReturnValueOnce("dup")
      .mockReturnValueOnce("dup")
      .mockReturnValueOnce("unique");

    const resolveMock = jest.fn();
    const rejectMock = jest.fn();

    const first = service.createSession(user, "key1", "ext1", resolveMock, rejectMock);
    expect(first.uuid).toBe("dup");
    expect(first.key).toBe("key1");
    expect(first.extension).toBe("ext1");
    expect(first.url.url).toBe("/attributes/buffer/dup");

    const second = service.createSession(user, "key2", "ext2", resolveMock, rejectMock);
    expect(second.uuid).toBe("unique");
    expect(second.key).toBe("key2");
    expect(second.url.url).toBe("/attributes/buffer/unique");
  });

  it("rejects a session after timeout", () => {
    const resolveMock = jest.fn();
    const rejectMock = jest.fn();
    randomUUIDMock.mockReturnValueOnce("dup");
    const session = service.createSession(user, "key", "ext", resolveMock, rejectMock);
    const uuid = session.uuid;

    jest.advanceTimersByTime(30_000);

    expect(rejectMock).toHaveBeenCalledTimes(1);
    const error = rejectMock.mock.calls[0][0];
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("Attribute upload session timed out");

    expect(() => service.resolveSession(uuid, Buffer.from("data"), user)).toThrow(
      BadRequestException,
    );
  });

  it("clears timeout and does not reject after resolve", () => {
    const resolveMock = jest.fn();
    const rejectMock = jest.fn();
    const session = service.createSession(user, "key", "ext", resolveMock, rejectMock);
    const uuid = session.uuid;

    service.resolveSession(uuid, Buffer.from("data"), user);

    expect(resolveMock).toHaveBeenCalledWith(Buffer.from("data"));
    expect(rejectMock).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    expect(rejectMock).not.toHaveBeenCalled();

    expect(() => service.resolveSession(uuid, Buffer.from("data"), user)).toThrow(
      BadRequestException,
    );
  });

  it("throws ForbiddenException when user does not match", () => {
    const resolveMock = jest.fn();
    const rejectMock = jest.fn();
    const session = service.createSession(user, "key", "ext", resolveMock, rejectMock);
    const uuid = session.uuid;
    const otherUser = { uuid: "other-uuid" } as any;

    expect(() => service.resolveSession(uuid, Buffer.from("data"), otherUser)).toThrow(
      ForbiddenException,
    );
  });

  it("throws BadRequestException when session does not exist", () => {
    const resolveMock = jest.fn();
    const rejectMock = jest.fn();
    const fakeUuid = "non-existent";

    expect(() => service.resolveSession(fakeUuid, Buffer.from("data"), user)).toThrow(
      BadRequestException,
    );
  });
});
