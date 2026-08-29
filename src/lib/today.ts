/**
 * The build date, fixed once per build.
 *
 * Read here rather than at each call site so every page in a deploy agrees on
 * what "today" is. A page that computed its own would disagree with its
 * neighbour across a midnight build.
 */
export const TODAY: string = (process.env.ANTAR_BUILD_DATE ?? new Date().toISOString()).slice(0, 10);
