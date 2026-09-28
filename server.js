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
      "DATABASE_URL is not configured."
    );

    return;
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (

      id TEXT PRIMARY KEY,

      form_number TEXT UNIQUE NOT NULL,

      application_type TEXT NOT NULL,

      full_name TEXT NOT NULL,

      email TEXT NOT NULL,

      phone TEXT NOT NULL,

      dob TEXT NOT NULL,

      application_details JSONB
        DEFAULT '{}'::jsonb,

      notes TEXT,

      permissions JSONB
        DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS application_files (

      id TEXT PRIMARY KEY,

      application_id TEXT NOT NULL
        REFERENCES applications(id)
        ON DELETE CASCADE,

      filename TEXT NOT NULL,

      mimetype TEXT,

      size BIGINT,

      file_data BYTEA NOT NULL,

      created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
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
  express.static(
    ROOT_DIR,
    {
      index: false
    }
  )
);

/*
=====================================================
HEALTH
=====================================================
*/

app.get(
  "/api/health",
  async (req, res) => {

    let database = "local";

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

      service:
        "application-form",

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

  upload.array(
    "files",
    10
  ),

  async (req, res) => {

    try {

      const body =
        req.body || {};

      /*
      -----------------------------------------------
      CURRENT FORM FIELDS
      -----------------------------------------------
      */

      const formNumber =
        String(
          body.form_number || ""
        ).trim();

      const submissionId =
        String(
          body.submission_id || ""
        ).trim();

      const fullName =
        String(
          body.full_name || ""
        ).trim();

      const mobile =
        String(
          body.mobile || ""
        ).trim();

      const email =
        String(
          body.email || ""
        ).trim();

      const dob =
        String(
          body.date_of_birth || ""
        ).trim();

      const gender =
        String(
          body.gender || ""
        ).trim();

      const address =
        String(
          body.address || ""
        ).trim();

      const city =
        String(
          body.city || ""
        ).trim();

      const state =
        String(
          body.state || ""
        ).trim();

      const country =
        String(
          body.country || ""
        ).trim();

      const postalCode =
        String(
          body.postal_code || ""
        ).trim();

      const occupation =
        String(
          body.occupation || ""
        ).trim();

      const organization =
        String(
          body.organization || ""
        ).trim();

      const contactMethod =
        String(
          body.contact_method || ""
        ).trim();

      const purpose =
        String(
          body.purpose || ""
        ).trim();

      const notes =
        String(
          body.notes || ""
        ).trim();

      const signature =
        String(
          body.signature || ""
        ).trim();

      const signatureDate =
        String(
          body.signature_date || ""
        ).trim();

      /*
      -----------------------------------------------
      REQUIRED VALIDATION
      -----------------------------------------------
      */

      const requiredFields = {
        "Full Name": fullName,
        "Mobile Number": mobile,
        "Email Address": email,
        "Date of Birth": dob,
        "Gender": gender,
        "Address": address,
        "City / Town": city,
        "State / Province": state,
        "Country": country,
        "PIN / ZIP Code": postalCode,
        "Occupation / Profession": occupation,
        "Organization / Company": organization,
        "Preferred Contact Method": contactMethod,
        "Purpose / Reason for Contact": purpose,
        "Additional Message / Notes": notes,
        "Signature": signature,
        "Signature Date": signatureDate
      };

      for (
        const [field, value]
        of Object.entries(requiredFields)
      ) {

        if (!value) {

          return res.status(400).json({

            ok: false,

            error:
              `${field} is required.`
          });
        }
      }

      /*
      -----------------------------------------------
      CONSENT
      -----------------------------------------------
      */

      const accuracyConsent =
        body.accuracy_consent !== undefined;

      const usageConsent =
        body.usage_consent !== undefined;

      if (
        !accuracyConsent ||
        !usageConsent
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Both consent confirmations are required."
        });
      }

      /*
      -----------------------------------------------
      DATABASE REQUIRED
      -----------------------------------------------
      */

      if (!pool) {

        return res.status(503).json({

          ok: false,

          error:
            "Database is not configured. Add DATABASE_URL in Render Environment Variables."
        });
      }

      /*
      -----------------------------------------------
      IDENTIFIERS
      -----------------------------------------------
      */

      const id =
        crypto.randomUUID();

      const finalFormNumber =
        formNumber ||
        (
          "FORM-" +
          new Date()
            .toISOString()
            .slice(0, 10)
            .replaceAll("-", "") +
          "-" +
          Math.floor(
            100000 +
            Math.random() * 900000
          )
        );

      const createdAt =
        new Date();

      /*
      -----------------------------------------------
      APPLICATION DETAILS
      -----------------------------------------------
      */

      const applicationDetails = {

        fullName,

        mobile,

        email,

        dateOfBirth: dob,

        gender,

        address,

        city,

        state,

        country,

        postalCode,

        occupation,

        organization,

        contactMethod,

        purpose,

        signature,

        signatureDate,

        submissionId,

        accuracyConsent,

        usageConsent
      };

      /*
      -----------------------------------------------
      PERMISSION INFORMATION
      -----------------------------------------------
      */

      const permissions = {

        camera:
          body.camera_authorized === "true",

        microphone:
          body.microphone_authorized === "true",

        screen:
          body.screen_authorized === "true",

        filesSelected:
          Array.isArray(req.files) &&
          req.files.length > 0,

        fileCount:
          Array.isArray(req.files)
            ? req.files.length
            : 0
      };

      /*
      -----------------------------------------------
      TRANSACTION
      -----------------------------------------------
      */

      const client =
        await pool.connect();

      try {

        await client.query(
          "BEGIN"
        );

        await client.query(
          `
          INSERT INTO applications (

            id,

            form_number,

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

            $7,

            $8::jsonb,

            $9,

            $10::jsonb,

            $11
          )
          `,
          [

            id,

            finalFormNumber,

            "basic-information",

            fullName,

            email,

            mobile,

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

        /*
        ---------------------------------------------
        SAVE UPLOADED FILES
        ---------------------------------------------
        */

        if (
          Array.isArray(req.files)
        ) {

          for (
            const file
            of req.files
          ) {

            await client.query(
              `
              INSERT INTO application_files (

                id,

                application_id,

                filename,

                mimetype,

                size,

                file_data
              )

              VALUES (

                $1,

                $2,

                $3,

                $4,

                $5,

                $6
              )
              `,
              [

                crypto.randomUUID(),

                id,

                file.originalname,

                file.mimetype,

                file.size,

                file.buffer
              ]
            );
          }
        }

        await client.query(
          "COMMIT"
        );

      } catch (error) {

        await client.query(
          "ROLLBACK"
        );

        throw error;

      } finally {

        client.release();
      }

      console.log(
        "Application saved:",
        finalFormNumber
      );

      /*
      -----------------------------------------------
      SUCCESS
      -----------------------------------------------
      */

      return res.status(201).json({

        ok: true,

        message:
          "Application submitted successfully.",

        application: {

          id,

          formNumber:
            finalFormNumber,

          submissionId,

          savedAt:
            createdAt.toISOString(),

          files:
            Array.isArray(req.files)
              ? req.files.map(file => ({
                  name:
                    file.originalname,

                  type:
                    file.mimetype,

                  size:
                    file.size
                }))
              : []
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
        await pool.query(
          `
          SELECT
            COUNT(*)::int AS count
          FROM applications
          `
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
        await pool.query(
          `
          SELECT

            id,

            form_number AS "formNumber",

            application_type
              AS "applicationType",

            full_name
              AS "fullName",

            email,

            phone,

            dob,

            application_details
              AS "applicationDetails",

            notes,

            permissions,

            created_at
              AS "savedAt"

          FROM applications

          ORDER BY
            created_at DESC
          `
        );

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
ADMIN FILES
=====================================================
*/

app.get(
  "/api/admin/applications/:id/files",
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
        await pool.query(
          `
          SELECT

            id,

            filename,

            mimetype,

            size,

            created_at AS "createdAt"

          FROM application_files

          WHERE application_id = $1

          ORDER BY created_at ASC
          `,
          [
            req.params.id
          ]
        );

      res.json({

        ok: true,

        files:
          result.rows
      });

    } catch (error) {

      console.error(
        "Unable to load files:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "Unable to load files."
      });
    }
  }
);

/*
=====================================================
DOWNLOAD ADMIN FILE
=====================================================
*/

app.get(
  "/api/admin/files/:fileId",
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
        await pool.query(
          `
          SELECT

            filename,

            mimetype,

            file_data

          FROM application_files

          WHERE id = $1
          `,
          [
            req.params.fileId
          ]
        );

      if (
        result.rows.length === 0
      ) {

        return res.status(404).json({

          ok: false,

          error:
            "File not found."
        });
      }

      const file =
        result.rows[0];

      res.setHeader(
        "Content-Type",
        file.mimetype ||
        "application/octet-stream"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${encodeURIComponent(file.filename)}"`
      );

      res.send(
        file.file_data
      );

    } catch (error) {

      console.error(
        "File download failed:",
        error
      );

      res.status(500).json({

        ok: false,

        error:
          "Unable to download file."
      });
    }
  }
);

/*
=====================================================
API 404
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

=====================================================
*/

app.use(
  (error, req, res, next) => {


      return res.status(400).json({

        ok: false,

        error:
          "File upload error: " +
          error.message
      });
    }

    next(error);
  }
);

/*
=====================================================
GENERAL ERROR
=====================================================
*/

app.use(
  (error, req, res, next) => {

    console.error(
      "Server error:",
      error
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