// K15 + K19: which build this is. This file is your owner build (every feature).
// tools/build_zip.py writes a different copy into the public and beta zips.
// (An object, not constants, so tests can try the public build.)

export const BUILD = { kind: 'owner', beta: false };

// Only the owner build may change anything on Canvas (F2 mark read, F13, F14).
export const canWrite = () => BUILD.kind === 'owner';

// K25: every build may use the Canvas inbox (send, reply, star, archive, mark read),
// and nothing else: see isMessageWrite in lib/canvas.js.
export const canMessage = () => true;
