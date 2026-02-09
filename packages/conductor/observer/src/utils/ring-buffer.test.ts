import { describe, it, expect } from "vitest";
import { RingBuffer } from "./ring-buffer.js";

describe("RingBuffer", () => {
  it("should store items up to capacity", () => {
    const buffer = new RingBuffer<string>(3);
    buffer.push("a");
    buffer.push("b");
    buffer.push("c");
    expect(buffer.toArray()).toEqual(["a", "b", "c"]);
  });

  it("should overwrite oldest items when full", () => {
    const buffer = new RingBuffer<string>(3);
    buffer.push("a");
    buffer.push("b");
    buffer.push("c");
    buffer.push("d");
    expect(buffer.toArray()).toEqual(["b", "c", "d"]);
  });

  it("should return correct size", () => {
    const buffer = new RingBuffer<string>(5);
    buffer.push("a");
    buffer.push("b");
    expect(buffer.size).toBe(2);
  });

  it("should clear all items", () => {
    const buffer = new RingBuffer<string>(3);
    buffer.push("a");
    buffer.push("b");
    buffer.clear();
    expect(buffer.size).toBe(0);
    expect(buffer.toArray()).toEqual([]);
  });

  it("should get last N items", () => {
    const buffer = new RingBuffer<string>(5);
    buffer.push("a");
    buffer.push("b");
    buffer.push("c");
    buffer.push("d");
    expect(buffer.getLast(2)).toEqual(["c", "d"]);
  });
});
