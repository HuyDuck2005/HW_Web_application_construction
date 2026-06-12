import opossum from "opossum";

export function createOutboxProcessor(db, courseServiceUrl, options = {}) {
  const {
    timeout = 5000,
    errorThresholdPercentage = 50,
    resetTimeout = 30000,
    batchSize = 10,
    maxAttempts = 5,
  } = options;

  const breaker = new opossum(async (event) => {
    const response = await fetch(courseServiceUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventId: event.event_id,
        enrollmentId: event.payload.enrollmentId,
        studentId: event.payload.studentId,
        courseId: event.payload.courseId,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to publish event: ${response.status} ${text}`);
    }

    return response.json();
  }, {
    timeout,
    errorThresholdPercentage,
    resetTimeout,
  });

  breaker.fallback(() => {
    throw new Error("Course service is currently unavailable. Circuit breaker open.");
  });

  async function processPendingEvents() {
    const events = await db("outbox_events")
      .where("status", "PENDING")
      .orderBy("created_at", "asc")
      .limit(batchSize);

    for (const event of events) {
      const nextAttempts = event.attempts + 1;
      try {
        await breaker.fire(event);

        await db("outbox_events")
          .where({ event_id: event.event_id })
          .update({
            status: "PROCESSED",
            processed_at: db.fn.now(),
            attempts: nextAttempts,
            last_error: null,
          });
      } catch (error) {
        const updates = {
          attempts: nextAttempts,
          last_error: error.message,
        };

        if (nextAttempts >= maxAttempts) {
          updates.status = "FAILED";
        }

        await db("outbox_events")
          .where({ event_id: event.event_id })
          .update(updates);
      }
    }

    return events.length;
  }

  return {
    processPendingEvents,
    status() {
      return {
        state: breaker.stats.fired ? "active" : "idle",
        open: breaker.opened,
        closed: breaker.closed,
        halfOpen: breaker.halfOpen,
        stats: breaker.stats,
      };
    },
  };
}
