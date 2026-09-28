"use strict";

const crypto = require("crypto");

const sessions = new Map();

const SESSION_TTL_MS =
  30 * 60 * 1000; // 30 minutes


function createSession() {

  const token =
    crypto.randomBytes(32).toString("hex");

  sessions.set(token, {
    createdAt: Date.now(),
    expiresAt:
      Date.now() + SESSION_TTL_MS
  });

  return token;
}


function destroySession(token) {

  if (token) {
    sessions.delete(token);
  }
}


function getSession(token) {

  if (!token) {
    return null;
  }

  const session =
    sessions.get(token);

  if (!session) {
    return null;
  }

  if (
    Date.now() >
    session.expiresAt
  ) {

    sessions.delete(token);

    return null;
  }

  return session;
}


function requireSession(req, res, next) {

  const header =
    req.get("Authorization") || "";

  if (
    !header.startsWith("Bearer ")
  ) {

    return res.status(401).json({
      ok: false,
      error: "Authentication required."
    });
  }

  const token =
    header.slice(7).trim();

  const session =
    getSession(token);

  if (!session) {

    return res.status(401).json({
      ok: false,
      error: "Invalid or expired session."
    });
  }

  req.session = session;

  next();
}


function cleanupExpiredSessions() {

  const now = Date.now();

  for (
    const [token, session]
    of sessions
  ) {

    if (
      now >
      session.expiresAt
    ) {

      sessions.delete(token);
    }
  }
}


setInterval(
  cleanupExpiredSessions,
  5 * 60 * 1000
).unref();


module.exports = {
  createSession,
  destroySession,
  getSession,
  requireSession
};