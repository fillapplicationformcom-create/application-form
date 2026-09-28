"use strict";

const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const {
  createSession,
  requireSession
} = require("./auth");

const app = express();

const PORT = process.env.PORT || 3000;
const ROOT_DIR = __dirname;
const DATA_FILE = path.join(ROOT_DIR, "applications.json");

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

app.use(
  express.json({
    limit: "10mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "10mb"
  })
);

/* =====================================================
   APPLICATION DATA
===================================================== */

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(
      DATA_FILE,
      "[]",
      "utf8"
    );
  }
}

function readApplications() {
  ensureDataFile();

  try {
    const raw = fs.readFileSync(
      DATA_FILE,
      "utf8"
    );

    const data = JSON.parse(raw);

    return Array.isArray(data)
      ? data
      : [];
  } catch (error) {
    console.error(
      "Unable to read applications:",
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
   STATIC FILES
===================================================== */

app.use(
  express.static(ROOT_DIR, {
    index: false
  })
);

/* =====================================================
   HEALTH CHECK
===================================================== */

app.get(
  "/api/health",
  (req, res) => {
    res.json({
      ok: true,
      service: "application-form",
      time: new Date().toISOString()
    });
  }
);

/* =====================================================
   HOME PAGE
===================================================== */

app.get(
  "/",
  (req, res) => {
    res.sendFile(
      path.join(
        ROOT_DIR,
        "index.html"
      )
    );
  }
);

/* =====================================================
   APPLICATION SUBMISSION
===================================================== */

app.post(
  "/api/applications",
  (req, res) => {
    try {
      const body = req.body || {};

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

      if (!applicationType) {
        return res.status(400).json({
          ok: false,
          error:
            "Application type is required."
        });
      }

      if (!fullName) {
        return res.status(400).json({
          ok: false,
          error:
            "Full name is required."
        });
      }

      if (!email) {
        return res.status(400).json({
          ok: false,
          error:
            "Email is required."
        });
      }

      const application = {
        id: crypto.randomUUID(),

        applicationType,

        fullName,
        email,
        phone,
        dob,

        applicationDetails:
          body.applicationDetails || {},

        notes,

        savedAt:
          new Date().toISOString()
      };

      const applications =
        readApplications();

      applications.push(
        application
      );

      writeApplications(
        applications
      );

      return res.status(201).json({
        ok: true,

        application: {
          id: application.id,
          savedAt:
            application.savedAt
        }
      });

    } catch (error) {
      console.error(
        "Application submission failed:",
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
   APPLICATION COUNT
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
   ADMIN LOGIN
===================================================== */

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
        error:
          "Invalid administrator token."
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

/* =====================================================
   ADMIN STATUS
===================================================== */

app.get(
  "/api/admin/status",
  requireSession,
  (req, res) => {
    res.json({
      ok: true,
      authenticated: true
    });
  }
);

/* =====================================================
   ADMIN APPLICATIONS
===================================================== */

app.get(
  "/api/admin/applications",
  requireSession,
  (req, res) => {
    try {
      const applications =
        readApplications();

      res.json({
        ok: true,
        applications
      });

    } catch (error) {
      console.error(
        "Unable to load applications:",
        error
      );

      res.status(500).json({
        ok: false,
        error:
          "Unable to load applications."
      });
    }
  }
);

/* =====================================================
   404 API HANDLER
===================================================== */

app.use(
  "/api",
  (req, res) => {
    res.status(404).json({
      ok: false,
      error: "API endpoint not found."
    });
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
        "Internal server error."
    });
  }
);

/* =====================================================
   START SERVER
===================================================== */

ensureDataFile();

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log(
      `Application Form running on port ${PORT}`
    );
  }
);
