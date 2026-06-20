import { createClient } from "redis";

const REDIS_URL = process.env.REDIS_URL ?? "redis://localhost:6379";
const COURSE_CACHE_TTL_SECONDS = Number(
  process.env.COURSE_CACHE_TTL_SECONDS ?? 60
);
const REDIS_CONNECT_TIMEOUT_MS = Number(
  process.env.REDIS_CONNECT_TIMEOUT_MS ?? 500
);
const REDIS_COMMAND_TIMEOUT_MS = Number(
  process.env.REDIS_COMMAND_TIMEOUT_MS ?? 500
);
const COURSE_CACHE_PREFIX = process.env.COURSE_CACHE_PREFIX ?? "course";
const TOP_COURSES_KEY = process.env.COURSE_TOP_COURSES_KEY ?? "courses:top";
const TOP_COURSES_READY_KEY =
  process.env.COURSE_TOP_COURSES_READY_KEY ?? "courses:top:ready";

let client;
let connectPromise;

function courseKey(id) {
  return `${COURSE_CACHE_PREFIX}:${id}`;
}

function getClient() {
  if (!client) {
    client = createClient({
      url: REDIS_URL,
      socket: {
        connectTimeout: REDIS_CONNECT_TIMEOUT_MS,
        reconnectStrategy(retries) {
          if (retries > 3) {
            return false;
          }
          return Math.min(retries * 100, 2000);
        }
      }
    });

    client.on("error", (error) => {
      console.warn("[course-cache] redis error:", error.message);
    });
  }
  return client;
}

async function getConnectedClient() {
  const redisClient = getClient();

  if (redisClient.isReady) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient.connect().finally(() => {
      connectPromise = null;
    });
  }

  await connectPromise;
  return redisClient;
}

function withTimeout(promise, timeoutMs) {
  let timeoutId;

  return Promise.race([
    promise,
    new Promise((_, reject) => {
      timeoutId = setTimeout(() => {
        reject(new Error(`Redis operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    })
  ]).finally(() => {
    clearTimeout(timeoutId);
  });
}

async function withRedis(operation, fallback = null) {
  try {
    return await withTimeout(
      (async () => {
        const redisClient = await getConnectedClient();
        return operation(redisClient);
      })(),
      REDIS_COMMAND_TIMEOUT_MS
    );
  } catch (error) {
    console.warn("[course-cache] bypassed:", error.message);
    return fallback;
  }
}

export async function getCachedCourse(id) {
  return withRedis(async (redisClient) => {
    const raw = await redisClient.sendCommand(["GET", courseKey(id)]);
    if (!raw) {
      return null;
    }
    
    try {
      return JSON.parse(raw);
    } catch {
      await redisClient.sendCommand(["DEL", courseKey(id)]);
      return null;
    }
  });
}

export async function setCachedCourse(course) {
  if (!course?.id) {
    return false;
  }

  return withRedis(async (redisClient) => {
    await redisClient.sendCommand([
      "SET",
      courseKey(course.id),
      JSON.stringify(course),
      "EX",
      String(COURSE_CACHE_TTL_SECONDS)
    ]);
    return true;
  }, false);
}

export async function invalidateCachedCourse(id) {
  return withRedis(async (redisClient) => {
    await redisClient.sendCommand(["DEL", courseKey(id)]);
    return true;
  }, false);
}

export async function isTopCourseIndexReady() {
  return withRedis(async (redisClient) => {
    const value = await redisClient.sendCommand(["GET", TOP_COURSES_READY_KEY]);
    return value === "1";
  }, false);
}

export async function rebuildTopCourseIndex(courses) {
  return withRedis(async (redisClient) => {
    await redisClient.sendCommand(["DEL", TOP_COURSES_KEY]);

    for (const course of courses) {
      await redisClient.sendCommand([
        "ZADD",
        TOP_COURSES_KEY,
        String(Number(course.enrolled_count) || 0),
        course.id
      ]);
    }

    await redisClient.sendCommand(["SET", TOP_COURSES_READY_KEY, "1"]);
    return true;
  }, false);
}

export async function getTopCourseIds(limit) {
  return withRedis(async (redisClient) => {
    return redisClient.sendCommand([
      "ZREVRANGE",
      TOP_COURSES_KEY,
      "0",
      String(limit - 1)
    ]);
  }, []);
}

export async function updateTopCoursesScore(course) {
  if (!course?.id) {
    return false;
  }

  return withRedis(async (redisClient) => {
    await redisClient.sendCommand([
      "ZADD",
      TOP_COURSES_KEY,
      String(Number(course.enrolled_count) || 0),
      course.id
    ]);
    return true;
  }, false);
}

export async function pingRedis() {
  return withRedis(async (redisClient) => {
    return redisClient.sendCommand(["PING"]);
  });
}

export async function closeRedis() {
  if (client?.isOpen) {
    await client.quit();
  }
}