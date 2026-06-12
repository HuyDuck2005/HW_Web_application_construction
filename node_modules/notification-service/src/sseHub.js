import { randomUUID } from 'node:crypto';

const clients = new Map();

function writeSseEvent(res, { id, event, data, retry }) {
  if (id) {
    res.write(`id: ${id}\n`);
  }

  if (event) {
    res.write(`event: ${event}\n`);
  }

  if (retry) {
    res.write(`retry: ${retry}\n`);
  }

  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function addClient({ req, res }) {
  const clientId = randomUUID();
  const courseId = req.query.courseId?.toString() ?? null;

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  res.write(': connected\n\n'); 

  const client = {
    id: clientId,
    studentId: req.user.studentId,
    courseId,
    res,
    connectedAt: new Date(),
  };

  clients.set(clientId, client);

  writeSseEvent(res, {
    event: 'notification.connected',
    data: {
      clientId,
      studentId: client.studentId,
      courseId,
      message: 'SSE connected',
    },
  });

  req.on('close', () => {
    clients.delete(clientId);
    console.log(`[sse] client disconnected id=${clientId}`);
  });

  console.log(`[sse] client connected id=${clientId} studentId=${client.studentId}`);

  return client;
}

export function broadcastCourseEnrollmentCountIncreased(event) {
  const payload = event.payload;
  let sent = 0;

  for (const client of clients.values()) {
    const subscribedToAllCourses = !client.courseId;
    const subscribedToThisCourse = client.courseId === payload.courseId;

    if (!subscribedToAllCourses && !subscribedToThisCourse) {
      continue;
    }

    writeSseEvent(client.res, {
      id: event.eventId,
      event: 'course.enrolled_count.increased',
      data: {
        eventId: event.eventId,
        eventType: event.eventType,
        occurredAt: event.occurredAt,
        courseId: payload.courseId,
        courseTitle: payload.courseTitle,
        enrolledCount: payload.enrolledCount,
        incrementBy: payload.incrementBy,
        enrollmentId: payload.enrollmentId,
        studentId: payload.studentId,
      },
    });

    sent += 1;
  }

  return sent;
}

export function startHeartbeat() {
  setInterval(() => {
    for (const client of clients.values()) {
      client.res.write(': heartbeat\n\n');
    }
  }, 25000);
}

export function getClientCount() {
  return clients.size;
}