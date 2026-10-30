import { describe, expect, it, vi } from "vitest";
import { beginUpdate } from "./update";

describe("atualização", () => {
  it("avisa, grava e recarrega uma única vez", async () => {
    vi.useFakeTimers();
    const persist = vi.fn(() => Promise.resolve());
    const notify = vi.fn();
    const reload = vi.fn();
    beginUpdate(persist, notify, reload);
    beginUpdate(persist, notify, reload);
    await vi.advanceTimersByTimeAsync(0);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(persist).toHaveBeenCalledTimes(1);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1199);
    expect(reload).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(reload).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});
