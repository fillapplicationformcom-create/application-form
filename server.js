"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const fs = require("fs");
const { Pool } = require("pg");

const {
  createSession,
  requireSession
} = require("./auth");

const app = express();

const PORT = process.env.PORT || 3000;

const ROOT_DIR = __dirname;

const ADMIN_TOKEN =
  process.env.ADMIN_TOKEN || "";

const DATABASE_URL =
  process.env.DATABASE_URL || "";

/*
=====================================================
DATABASE
=====================================================
*/

let pool = null;

if (DATABASE_URL) {
  pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  pool.on("error", error => {
    console.error(
      "PostgreSQL pool error:",
      error
    );
  });
}

/*
=====================================================
LOCAL FALLBACK
=====================================================
*/

const LOCAL_DATA_FILE =
  path.join(
    ROOT_DIR,
    "applications.json"
  );

function ensureLocalFile() {
  if (!fs.existsSync(LOCAL_DATA_FILE)) {
    fs.writeFileSync(
      LOCAL_DATA_FILE,
      "[]",
      "utf8"
    );
  }
}

function readLocalApplications() {
  ensureLocalFile();

  try {
    return JSON.parse(
      fs.readFileSync(
        LOCAL_DATA_FILE,
        "utf8"
      )
    );
  } catch {
    return [];
  }
}

function writeLocalApplications(
  applications
) {
  fs.writeFileSync(
    LOCAL_DATA_FILE,
    JSON.stringify(
      applications,
      null,
      2
    ),
    "utf8"
  );
}

/*
=====================================================
DATABASE INITIALIZATION
=====================================================
*/

async function initializeDatabase() {

  if (!pool) {
    console.warn(
      "DATABASE_URL is not configured. " +
      "Using temporary local storage."
    );

    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (
      id TEXT PRIMARY KEY,
      application_type TEXT NOT NULL,
      full_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      dob TEXT,
      application_details JSONB DEFAULT '{}'::jsonb,
      notes TEXT,
      permissions JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  console.log(
    "PostgreSQL database initialized."
  );
}

/*
=====================================================
MIDDLEWARE
=====================================================
*/

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

app.use(
  express.static(ROOT_DIR, {
    index: false
  })
);

/*
=====================================================
HEALTH
=====================================================
*/

app.get(
  "/api/health",
  async (req, res) => {

    let database =
      "local";

    if (pool) {

      try {

        await pool.query(
          "SELECT 1"
        );

        database =
          "postgresql";

      } catch {

        database =
          "postgresql-error";
      }
    }

    res.json({
      ok: true,
      service: "application-form",
      database,
      time:
        new Date().toISOString()
    });
  }
);

/*
=====================================================
HOME
=====================================================
*/

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

/*
=====================================================
CREATE APPLICATION
=====================================================
*/

app.post(
  "/api/applications",
  async (req, res) => {

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

      const applicationDetails =
        body.applicationDetails || {};

      const permissions =
        body.permissions || {};

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

      /*
      ---------------------------------------------
      IMPORTANT:
      Require PostgreSQL for persistent production
      storage.
      ---------------------------------------------
      */

      if (!pool) {

        return res.status(503).json({
          ok: false,
          error:
            "Database is not configured. " +
            "Add DATABASE_URL in Render Environment Variables."
        });
      }

      const id =
        crypto.randomUUID();

      const createdAt =
        new Date();

      await pool.query(
        `
        INSERT INTO applications (
          id,
          application_type,
          full_name,
          email,
          phone,
          dob,
          application_details,
          notes,
          permissions,
          created_at
        )
        VALUES (
          $1,
          $2,
          $3,
          $4,
          $5,
          $6,
          $7::jsonb,
          $8,
          $9::jsonb,
          $10
        )
        `,
        [
          id,
          applicationType,
          fullName,
          email,
          phone,
          dob,
          JSON.stringify(
            applicationDetails
          ),
          notes,
          JSON.stringify(
            permissions
          ),
          createdAt
        ]
      );

      console.log(
        "Application saved:",
        id
      );

      return res.status(201).json({
        ok: true,
        application: {
          id,
          savedAt:
            createdAt.toISOString()
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

/*
=====================================================
APPLICATION COUNT
=====================================================
*/

app.get(
  "/api/applications/count",
  async (req, res) => {

    try {

      if (!pool) {
        return res.status(503).json({
          ok: false,
          error:
            "Database is not configured."
        });
      }

      const result =
        await pool.query(
          "SELECT COUNT(*)::int AS count FROM applications"
        );

      res.json({
        ok: true,
        count:
          result.rows[0].count
      });

    } catch (error) {

      console.error(error);

      res.status(500).json({
        ok: false,
        error:
          "Unable to count applications."
      });
    }
  }
);

/*
=====================================================
ADMIN LOGIN
=====================================================
*/

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
      token:
        sessionToken
    });
  }
);

/*
=====================================================
ADMIN STATUS
=====================================================
*/

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

/*
=====================================================
ADMIN APPLICATIONS
=====================================================
*/

app.get(
  "/api/admin/applications",
  requireSession,
  async (req, res) => {

    try {

      if (!pool) {

        return res.status(503).json({
          ok: false,
          error:
            "Database is not configured."
        });
      }

      const result =
        await pool.query(`
          SELECT
            id,
            application_type AS "applicationType",
            full_name AS "fullName",
            email,
            phone,
            dob,
            application_details AS "applicationDetails",
            notes,
            permissions,
            created_at AS "savedAt"
          FROM applications
          ORDER BY created_at DESC
        `);

      res.json({
        ok: true,
        applications:
          result.rows
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

/*
=====================================================
404 API
=====================================================
*/

app.use(
  "/api",
  (req, res) => {

    res.status(404).json({
      ok: false,
      error:
        "API endpoint not found."
    });
  }
);

/*
=====================================================
ERROR HANDLER
=====================================================
*/

app.use(
  (err, req, res, next) => {

    console.error(
      "Server error:",
      err
    );

    res.status(500).json({
      ok: false,
      error:
        "Internal server error."
    });
  }
);

/*
=====================================================
START
=====================================================
*/

async function startServer() {

  try {

    await initializeDatabase();

    app.listen(
      PORT,
      "0.0.0.0",
      () => {

        console.log(
          `Application Form running on port ${PORT}`
        );

      }
    );

  } catch (error) {

    console.error(
      "Unable to start server:",
      error
    );

    process.exit(1);
  }
}

startServer();
