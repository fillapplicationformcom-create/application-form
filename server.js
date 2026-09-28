"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const app = express();

const PORT = process.env.PORT || 3000;

const PUBLIC_DIR =
  path.join(__dirname, "..", "public");

const DATA_DIR =
  path.join(__dirname, "..", "data");

const DATA_FILE =
  path.join(DATA_DIR, "applications.json");


/* =====================================================
   INITIAL SETUP
===================================================== */

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, {
    recursive: true
  });
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(
    DATA_FILE,
    "[]",
    "utf8"
  );
}


/* =====================================================
   MIDDLEWARE
===================================================== */

app.use(
  express.json({
    limit: "2mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "2mb"
  })
);

app.use(
  express.static(PUBLIC_DIR)
);


/* =====================================================
   HELPERS
===================================================== */

function readApplications() {

  try {

    const contents =
      fs.readFileSync(
        DATA_FILE,
        "utf8"
      );

    const data =
      JSON.parse(contents);

    return Array.isArray(data)
      ? data
      : [];

  } catch (error) {

    console.error(
      "Unable to read application data:",
      error
    );

    return [];
  }
}


function writeApplications(applications) {

  fs.writeFileSync(
    DATA_FILE,
    JSON.stringify(
      applications,
      null,
      2
    ),
    "utf8"
  );
}


/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/api/health",
  (req, res) => {

    res.json({
      ok: true,
      service: "application-form",
      time:
        new Date().toISOString()
    });

  }
);


/* =====================================================
   CREATE APPLICATION
===================================================== */

app.post(
  "/api/applications",
  (req, res) => {

    try {

      const body =
        req.body || {};

      const applicationType =
        String(
          body.applicationType || ""
        ).trim();

      const applicant =
        body.applicant || {};

      const fullName =
        String(
          applicant.fullName || ""
        ).trim();

      const email =
        String(
          applicant.email || ""
        ).trim();

      const phone =
        String(
          applicant.phone || ""
        ).trim();

      const dob =
        String(
          applicant.dob || ""
        ).trim();

      const notes =
        String(
          body.notes || ""
        ).trim();


      /* REQUIRED FIELDS */

      if (
        !applicationType ||
        !fullName ||
        !email
      ) {

        return res.status(400).json({
          ok: false,
          error:
            "Application type, full name and email are required."
        });

      }


      /* CREATE SERVER RECORD */

      const record = {

        id:
          crypto.randomUUID(),

        applicationType,

        applicant: {
          fullName,
          email,
          phone,
          dob
        },

        applicationDetails:
          body.applicationDetails || {},

        notes,

        createdAt:
          new Date().toISOString()
      };


      const applications =
        readApplications();

      applications.push(record);

      writeApplications(
        applications
      );


      return res.status(201).json({

        ok: true,

        application: {
          id: record.id,
          applicationType:
            record.applicationType,
          createdAt:
            record.createdAt
        }

      });

    } catch (error) {

      console.error(
        "Application creation error:",
        error
      );

      return res.status(500).json({
        ok: false,
        error:
          "Unable to save application."
      });
    }
  }
);


/* =====================================================
   GET APPLICATION COUNT
===================================================== */

app.get(
  "/api/applications/count",
  (req, res) => {

    const applications =
      readApplications();

    res.json({
      ok: true,
      count:
        applications.length
    });

  }
);


/* =====================================================
   ADMIN APPLICATION LIST
===================================================== */

/*
  This endpoint is intentionally not exposed as a
  public unauthenticated application-data endpoint.

  The admin page should authenticate before requesting
  application records.
*/

app.get(
  "/api/admin/applications",
  (req, res) => {

    const adminToken =
      process.env.ADMIN_TOKEN;

    const suppliedToken =
      req.get("X-Admin-Token");


    if (
      !adminToken ||
      suppliedToken !== adminToken
    ) {

      return res.status(401).json({
        ok: false,
        error: "Unauthorized"
      });

    }


    const applications =
      readApplications();

    res.json({
      ok: true,
      applications
    });

  }
);


/* =====================================================
   ROOT
===================================================== */

app.get(
  "/",
  (req, res) => {

    res.sendFile(
      path.join(
        PUBLIC_DIR,
        "index.html"
      )
    );

  }
);


/* =====================================================
   ERROR HANDLER
===================================================== */

app.use(
  (err, req, res, next) => {

    console.error(err);

    res.status(500).json({
      ok: false,
      error:
        "Internal server error"
    });

  }
);


/* =====================================================
   START SERVER
===================================================== */

app.listen(
  PORT,
  () => {

    console.log(
      `Application Form running on port ${PORT}`
    );
// ============================================================
// ADMIN AUTHENTICATION
// ============================================================

const {
  createSession,
  requireSession
} = require("./auth");


// Set this in your environment instead of hard-coding it.
// Example:
// ADMIN_TOKEN=change-this-to-a-long-random-secret
const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN;

if (!ADMIN_TOKEN) {
  console.warn(
    "WARNING: ADMIN_TOKEN is not configured."
  );
}


// ============================================================
// ADMIN LOGIN
// ============================================================

app.post(
  "/api/admin/login",
  (req, res) => {

    const suppliedToken =
      String(
        req.body?.token || ""
      );

    if (
      !ADMIN_TOKEN ||
      !suppliedToken ||
      suppliedToken !== ADMIN_TOKEN
    ) {

      return res.status(401).json({
        ok: false,
        error: "Invalid administrator token."
      });
    }


    const sessionToken =
      createSession();


    res.json({
      ok: true,
      token: sessionToken
    });

  }
);


// ============================================================
// EXAMPLE PROTECTED ADMIN ENDPOINT
// ============================================================

app.get(
  "/api/admin/status",
  requireSession,
  (req, res) => {

    res.json({
      ok: true,
      authenticated: true
    });

  // ============================================================
// PROTECTED ADMIN APPLICATIONS ENDPOINT
// ============================================================

app.get(
  "/api/admin/applications",
  requireSession,
  async (req, res) => {

    try {

      const fs = require("fs/promises");
      const path = require("path");

      const dataPath =
        path.join(
          __dirname,
          "..",
          "data",
          "applications.json"
        );

      let applications = [];

      try {

        const raw =
          await fs.readFile(
            dataPath,
            "utf8"
          );

        applications =
          JSON.parse(raw);

        if (!Array.isArray(applications)) {
          applications = [];
        }

      } catch (error) {

        /*
         * A missing database starts as
         * an empty application collection.
         */

        if (error.code !== "ENOENT") {
          throw error;
        }
      }

      res.json({
        ok: true,
        applications
      });

    } catch (error) {

      console.error(
        "Unable to read applications:",
        error
      );

      res.status(500).json({
        ok: false,
        error: "Unable to load applications."
      });

  // ============================================================
// PUBLIC APPLICATION SUBMISSION
// ============================================================

const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const applicationsPath = path.join(
  __dirname,
  "..",
  "data",
  "applications.json"
);


async function ensureApplicationsFile() {

  const directory =
    path.dirname(applicationsPath);

  await fs.mkdir(
    directory,
    { recursive: true }
  );

  try {

    await fs.access(
      applicationsPath
    );

  } catch {

    await fs.writeFile(
      applicationsPath,
      "[]",
      "utf8"
    );
  }
}


app.post(
  "/api/applications",
  async (req, res) => {

    try {

      const {
        applicationType,
        fullName,
        email,
        phone,
        dob,
        notes
      } = req.body || {};


      // Basic validation

      if (
        typeof fullName !== "string" ||
        !fullName.trim()
      ) {

        return res.status(400).json({
          ok: false,
          error: "Full name is required."
        });
      }


      if (
        email !== undefined &&
        typeof email !== "string"
      ) {

        return res.status(400).json({
          ok: false,
          error: "Invalid email."
        });
      }


      if (
        phone !== undefined &&
        typeof phone !== "string"
      ) {

        return res.status(400).json({
          ok: false,
          error: "Invalid phone number."
        });
      }


      await ensureApplicationsFile();


      const raw =
        await fs.readFile(
          applicationsPath,
          "utf8"
        );


      let applications =
        JSON.parse(raw);


      if (!Array.isArray(applications)) {
        applications = [];
      }


      const application = {

        id:
          crypto.randomUUID(),

        applicationType:
          String(
            applicationType || ""
          ).trim(),

        fullName:
          fullName.trim(),

        email:
          String(
            email || ""
          ).trim(),

        phone:
          String(
            phone || ""
          ).trim(),

        dob:
          String(
            dob || ""
          ).trim(),

        notes:
          String(
            notes || ""
          ).trim(),

        savedAt:
          new Date().toISOString()

      };


      applications.push(
        application
      );


      await fs.writeFile(
        applicationsPath,
        JSON.stringify(
          applications,
          null,
          2
        ),
        "utf8"
      );


      res.status(201).json({

        ok: true,

        application: {
          id: application.id,
          savedAt: application.savedAt
        }

      });


    } catch (error) {

      console.error(
        "Application submission failed:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "Unable to save application."

      });
    }
  }
);