"use strict";

const crypto = require("crypto");

/* =====================================================
   CONFIGURATION
===================================================== */

const MAX_BODY_BYTES = 2 * 1024 * 1024;

const RATE_WINDOW_MS = 60 * 1000;
const RATE_LIMIT = 30;

const requests = new Map();


/* =====================================================
   RATE LIMITING
===================================================== */

function getClientKey(req) {
  return (
    req.ip ||
    req.headers["x-forwarded-for"] ||
    "unknown"
  );
}


function rateLimit(req, res, next) {

  const key = getClientKey(req);
  const now = Date.now();

  let entry = requests.get(key);

  if (!entry ||
      now - entry.startedAt >= RATE_WINDOW_MS) {

    entry = {
      startedAt: now,
      count: 0
    };

    requests.set(key, entry);
  }

  entry.count++;

  if (entry.count > RATE_LIMIT) {

    return res.status(429).json({
      ok: false,
      error: "Too many requests. Try again later."
    });
  }

  next();
}


/* =====================================================
   SECURITY HEADERS
===================================================== */

function securityHeaders(req, res, next) {

  res.setHeader(
    "X-Content-Type-Options",
    "nosniff"
  );

  res.setHeader(
    "X-Frame-Options",
    "DENY"
  );

  res.setHeader(
    "Referrer-Policy",
    "strict-origin-when-cross-origin"
  );

  res.setHeader(
    "Permissions-Policy",
    [
      "camera=(self)",
      "microphone=(self)",
      "geolocation=(self)",
      "notifications=(self)",
      "display-capture=(self)"
    ].join(", ")
  );

  res.setHeader(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self'",
      "connect-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join("; ")
  );

  next();
}


/* =====================================================
   REQUEST ID
===================================================== */

function requestId(req, res, next) {

  const id =
    crypto.randomUUID();

  req.requestId = id;

  res.setHeader(
    "X-Request-ID",
    id
  );

  next();
}


/* =====================================================
   INPUT CLEANING
===================================================== */

function cleanString(value, maxLength = 2000) {

  if (typeof value !== "string") {
    return "";
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maxLength);
}


function cleanEmail(value) {

  const email =
    cleanString(value, 254)
      .toLowerCase();

  const valid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      .test(email);

  return valid ? email : "";
}


function cleanPhone(value) {

  return cleanString(
    value,
    30
  ).replace(
    /[^0-9+\-() ]/g,
    ""
  );
}


/* =====================================================
   APPLICATION VALIDATION
===================================================== */

const ALLOWED_APPLICATION_TYPES = new Set([
  "Education - UG",
  "Education - PG",
  "NEET UG",
  "NEET PG",
  "Job / Recruitment",
  "Business",
  "Banking / Financial Application"
]);


function validateApplication(body) {

  if (!body || typeof body !== "object") {

    return {
      valid: false,
      error: "Invalid request body."
    };
  }


  const applicationType =
    cleanString(
      body.applicationType,
      100
    );


  if (
    !ALLOWED_APPLICATION_TYPES
      .has(applicationType)
  ) {

    return {
      valid: false,
      error: "Invalid application type."
    };
  }


  const applicant =
    body.applicant;


  if (
    !applicant ||
    typeof applicant !== "object"
  ) {

    return {
      valid: false,
      error: "Applicant information is required."
    };
  }


  const fullName =
    cleanString(
      applicant.fullName,
      150
    );


  const email =
    cleanEmail(
      applicant.email
    );


  const phone =
    cleanPhone(
      applicant.phone
    );


  const dob =
    cleanString(
      applicant.dob,
      20
    );


  if (!fullName) {

    return {
      valid: false,
      error: "Full name is required."
    };
  }


  if (!email) {

    return {
      valid: false,
      error: "A valid email is required."
    };
  }


  return {

    valid: true,

    value: {

      applicationType,

      applicant: {
        fullName,
        email,
        phone,
        dob
      },

      notes:
        cleanString(
          body.notes,
          5000
        )
    }
  };
}


/* =====================================================
   ADMIN TOKEN COMPARISON
===================================================== */

function safeTokenCompare(
  supplied,
  expected
) {

  if (
    typeof supplied !== "string" ||
    typeof expected !== "string"
  ) {
    return false;
  }

  const suppliedBuffer =
    Buffer.from(supplied);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    suppliedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    suppliedBuffer,
    expectedBuffer
  );
}


function requireAdmin(req, res, next) {

  const expected =
    process.env.ADMIN_TOKEN;

  const supplied =
    req.get("X-Admin-Token");


  if (!expected) {

    return res.status(503).json({
      ok: false,
      error: "Admin authentication is not configured."
    });
  }


  if (
    !safeTokenCompare(
      supplied,
      expected
    )
  ) {

    return res.status(401).json({
      ok: false,
      error: "Unauthorized."
    });
  }


  next();
}


/* =====================================================
   SECURITY EVENT LOGGER
===================================================== */

function securityLog(event, details = {}) {

  const entry = {

    timestamp:
      new Date().toISOString(),

    event,

    ...details
  };

  /*
   * Do not log passwords, tokens,
   * cookies, authorization headers,
   * camera frames or microphone data.
   */

  console.log(
    "[SECURITY]",
    JSON.stringify(entry)
  );
}


/* =====================================================
   EXPORTS
===================================================== */

module.exports = {

  MAX_BODY_BYTES,

  rateLimit,

  securityHeaders,

  requestId,

  cleanString,

  cleanEmail,

  cleanPhone,

  validateApplication,

  requireAdmin,

  securityLog
};