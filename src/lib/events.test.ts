import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isEventEnded, isEventActive, filterActiveEvents } from "./events.ts";

describe("events utility functions", () => {
  const baseNow = new Date("2026-11-10T12:00:00Z");

  it("identifies event as ended when status is 'completed' even if end_datetime is future", () => {
    const event = {
      start_datetime: "2026-11-10T13:00:00Z",
      end_datetime: "2026-11-10T15:00:00Z",
      status: "completed",
    };
    assert.equal(isEventEnded(event, baseNow), true);
    assert.equal(isEventActive(event, baseNow), false);
  });

  it("identifies event as ended when end_datetime has passed", () => {
    const event = {
      start_datetime: "2026-11-10T08:00:00Z",
      end_datetime: "2026-11-10T11:00:00Z",
      status: "published",
    };
    assert.equal(isEventEnded(event, baseNow), true);
    assert.equal(isEventActive(event, baseNow), false);
  });

  it("identifies event as ended when end_datetime is missing and start_datetime has passed", () => {
    const event = {
      start_datetime: "2026-11-10T10:00:00Z",
      status: "published",
    };
    assert.equal(isEventEnded(event, baseNow), true);
    assert.equal(isEventActive(event, baseNow), false);
  });

  it("identifies event as active when status is 'published' and end_datetime is future", () => {
    const event = {
      start_datetime: "2026-11-10T13:00:00Z",
      end_datetime: "2026-11-10T17:00:00Z",
      status: "published",
    };
    assert.equal(isEventEnded(event, baseNow), false);
    assert.equal(isEventActive(event, baseNow), true);
  });

  it("identifies event currently ongoing (started in past, ends in future) as active", () => {
    const event = {
      start_datetime: "2026-11-10T10:00:00Z",
      end_datetime: "2026-11-10T14:00:00Z",
      status: "published",
    };
    assert.equal(isEventEnded(event, baseNow), false);
    assert.equal(isEventActive(event, baseNow), true);
  });

  it("identifies cancelled or draft events as NOT active", () => {
    const cancelledEvent = {
      start_datetime: "2026-11-10T14:00:00Z",
      end_datetime: "2026-11-10T18:00:00Z",
      status: "cancelled",
    };
    assert.equal(isEventActive(cancelledEvent, baseNow), false);

    const draftEvent = {
      start_datetime: "2026-11-10T14:00:00Z",
      end_datetime: "2026-11-10T18:00:00Z",
      status: "draft",
    };
    assert.equal(isEventActive(draftEvent, baseNow), false);
  });

  it("filters out ended, cancelled, draft, or completed events from suggested/upcoming list", () => {
    const events = [
      {
        id: "1",
        title: "Future Published Event",
        start_datetime: "2026-11-10T15:00:00Z",
        end_datetime: "2026-11-10T18:00:00Z",
        status: "published",
      },
      {
        id: "2",
        title: "Past Ended Event",
        start_datetime: "2026-11-09T10:00:00Z",
        end_datetime: "2026-11-09T14:00:00Z",
        status: "published",
      },
      {
        id: "3",
        title: "Completed Event",
        start_datetime: "2026-11-10T16:00:00Z",
        end_datetime: "2026-11-10T20:00:00Z",
        status: "completed",
      },
      {
        id: "4",
        title: "Cancelled Event",
        start_datetime: "2026-11-10T16:00:00Z",
        end_datetime: "2026-11-10T20:00:00Z",
        status: "cancelled",
      },
      {
        id: "5",
        title: "Ongoing Active Event",
        start_datetime: "2026-11-10T11:00:00Z",
        end_datetime: "2026-11-10T16:00:00Z",
        status: "published",
      },
    ];

    const active = filterActiveEvents(events, baseNow);
    assert.equal(active.length, 2);
    assert.deepEqual(
      active.map((e) => e.id),
      ["1", "5"]
    );
  });

  it("handles empty or null arrays safely", () => {
    assert.deepEqual(filterActiveEvents(null, baseNow), []);
    assert.deepEqual(filterActiveEvents(undefined, baseNow), []);
    assert.deepEqual(filterActiveEvents([], baseNow), []);
  });
});
