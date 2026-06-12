import { broadcastCourseEnrollmentCountIncreased } from './sseHub.js';

export async function handleCourseEnrollmentCountIncreased(event) {
  if (event.eventType !== 'CourseEnrollmentCountIncreased') {
    throw new Error(`Unsupported eventType: ${event.eventType}`);
  }

  if (!event.payload?.courseId) {
    throw new Error(`Missing payload.courseId`);
  }

  const sent = broadcastCourseEnrollmentCountIncreased(event);

  console.log(
    `[notification-service] pushed eventId=${event.eventId} courseId=${event.payload.courseId} clients=${sent}`
  );

  return { sent };
}