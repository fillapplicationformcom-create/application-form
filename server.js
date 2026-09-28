"use strict";

const express = require("express");
const path = require("path");
const crypto = require("crypto");
const multer = require("multer");
const { Pool } = require("pg");

const {
  createSession,
  requireSession
} = require("./auth");

const app = express();

/* =========================================================
   CONFIGURATION
========================================================= */

const PORT = Number(process.env.PORT) || 3000;
const ROOT_DIR = __dirname;

const ADMIN_TOKEN =
  String(process.env.ADMIN_TOKEN || "").trim();

const DATABASE_URL =
  String(process.env.DATABASE_URL || "").trim();

/* =========================================================
   FILE UPLOAD CONFIGURATION
========================================================= */

const upload = multer({
  storage: multer.memoryStorage(),

  limits: {
    files: 10,
    fileSize: 10 * 1024 * 1024
  }
});

/* =========================================================
   DATABASE
========================================================= */

let pool = null;

if (DATABASE_URL) {

  pool = new Pool({
    connectionString: DATABASE_URL,

    ssl: {
      rejectUnauthorized: false
    },

    max: 10,

    idleTimeoutMillis: 30000,

    connectionTimeoutMillis: 10000
  });

  pool.on("error", error => {

    console.error(
      "PostgreSQL pool error:",
      error
    );

  });
}

/* =========================================================
   DATABASE INITIALIZATION
========================================================= */

async function initializeDatabase() {

  if (!pool) {

    console.warn(
      "DATABASE_URL is not configured."
    );

    return;
  }

  /*
  ---------------------------------------------------------
  APPLICATIONS TABLE
  ---------------------------------------------------------
  */

  await pool.query(`
    CREATE TABLE IF NOT EXISTS applications (

      id TEXT PRIMARY KEY,

      form_number TEXT UNIQUE NOT NULL,

      application_type TEXT NOT NULL
        DEFAULT 'basic-information',

      full_name TEXT NOT NULL,

      email TEXT,

      phone TEXT,

      dob TEXT,

      application_details JSONB
        NOT NULL DEFAULT '{}'::jsonb,

      notes TEXT,

      permissions JSONB
        NOT NULL DEFAULT '{}'::jsonb,

      created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    )
  `);

  /*
  ---------------------------------------------------------
  EXISTING DATABASE MIGRATION
  ---------------------------------------------------------
  */

  await pool.query(`
    ALTER TABLE applications
    ALTER COLUMN email DROP NOT NULL
  `);

  await pool.query(`
    ALTER TABLE applications
    ALTER COLUMN phone DROP NOT NULL
  `);

  await pool.query(`
    ALTER TABLE applications
    ALTER COLUMN dob DROP NOT NULL
  `);

  /*
  ---------------------------------------------------------
  FILES TABLE
  ---------------------------------------------------------
  */

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

      file_category TEXT
        DEFAULT 'other',

      created_at TIMESTAMPTZ
        NOT NULL DEFAULT NOW()
    )
  `);

  /*
  ---------------------------------------------------------
  MIGRATE EXISTING FILE TABLE
  ---------------------------------------------------------
  */

  await pool.query(`
    ALTER TABLE application_files
    ADD COLUMN IF NOT EXISTS file_category TEXT
    DEFAULT 'other'
  `);

  console.log(
    "PostgreSQL database initialized successfully."
  );
}

/* =========================================================
   MIDDLEWARE
========================================================= */

app.disable("x-powered-by");

app.use(
  express.json({
    limit: "15mb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "15mb"
  })
);

app.use(
  express.static(ROOT_DIR, {
    index: false
  })
);

/* =========================================================
   HELPER FUNCTIONS
========================================================= */

function clean(value) {

  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  return String(value).trim();
}

function makeFormNumber() {

  const now = new Date();

  const date =
    now
      .toISOString()
      .slice(0, 10)
      .replace(/-/g, "");

  const random =
    Math.floor(
      100000 +
      Math.random() * 900000
    );

  return `FORM-${date}-${random}`;
}

function makeSubmissionId() {

  return (
    "SUB-" +
    Date.now() +
    "-" +
    crypto
      .randomBytes(3)
      .toString("hex")
      .toUpperCase()
  );
}

function getFileCategory(file) {

  if (!file) {
    return "other";
  }

  const field =
    clean(file.fieldname).toLowerCase();

  if (
    field === "photo" ||
    field === "profile_photo" ||
    field === "profilePhoto"
  ) {
    return "photo";
  }

  if (
    field === "government_id" ||
    field === "governmentId" ||
    field === "gov_id" ||
    field === "govId"
  ) {
    return "government-id";
  }

  return "other";
}

function normalizeApplication(body) {

  const source =
    body || {};

  /*
  ---------------------------------------------------------
  SUPPORT BOTH:
  1. FLAT FORM DATA
  2. NESTED JSON
  ---------------------------------------------------------
  */

  const applicant =
    source.applicant &&
    typeof source.applicant === "object"
      ? source.applicant
      : {};

  const details =
    source.applicationDetails &&
    typeof source.applicationDetails === "object"
      ? source.applicationDetails
      : {};

  const permissions =
    source.permissions &&
    typeof source.permissions === "object"
      ? source.permissions
      : {};

  const fullName =
    clean(
      source.full_name ||
      source.fullName ||
      applicant.fullName
    );

  const mobile =
    clean(
      source.mobile ||
      source.phone ||
      applicant.phone
    );

  const email =
    clean(
      source.email ||
      applicant.email
    );

  const dob =
    clean(
      source.date_of_birth ||
      source.dob ||
      applicant.dob
    );

  const gender =
    clean(
      source.gender ||
      details.gender
    );

  const address =
    clean(
      source.address ||
      details.address
    );

  const city =
    clean(
      source.city ||
      details.city
    );

  const state =
    clean(
      source.state ||
      details.state
    );

  const country =
    clean(
      source.country ||
      details.country
    );

  const postalCode =
    clean(
      source.postal_code ||
      source.postalCode ||
      details.postalCode
    );

  const occupation =
    clean(
      source.occupation ||
      details.occupation
    );

  const organization =
    clean(
      source.organization ||
      details.organization
    );

  const contactMethod =
    clean(
      source.contact_method ||
      source.contactMethod ||
      details.contactMethod
    );

  const purpose =
    clean(
      source.purpose ||
      details.purpose
    );

  const notes =
    clean(
      source.notes ||
      source.additionalNotes ||
      details.additionalNotes
    );

  const signature =
    clean(
      source.signature ||
      details.signature
    );

  const signatureDate =
    clean(
      source.signature_date ||
      source.signatureDate ||
      details.signatureDate
    );

  const formNumber =
    clean(
      source.form_number ||
      source.formNumber ||
      details.formNumber
    );

  const submissionId =
    clean(
      source.submission_id ||
      source.submissionId ||
      details.submissionId
    );

  const accuracyConsent =
    source.accuracy_consent !== undefined
      ? Boolean(
          source.accuracy_consent === true ||
          source.accuracy_consent === "true" ||
          source.accuracy_consent === "on"
        )
      : Boolean(
          source.accuracyConsent
        );

  const usageConsent =
    source.usage_consent !== undefined
      ? Boolean(
          source.usage_consent === true ||
          source.usage_consent === "true" ||
          source.usage_consent === "on"
        )
      : Boolean(
          source.usageConsent
        );

  /*
  ---------------------------------------------------------
  PERMISSION INFORMATION
  ---------------------------------------------------------
  */

  const camera =
    source.camera_authorized !== undefined
      ? source.camera_authorized === "true"
      : Boolean(permissions.camera);

  const microphone =
    source.microphone_authorized !== undefined
      ? source.microphone_authorized === "true"
      : Boolean(permissions.microphone);

  const screen =
    source.screen_authorized !== undefined
      ? source.screen_authorized === "true"
      : Boolean(permissions.screen);

  return {

    fullName,

    mobile,

    email,

    dob,

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

    notes,

    signature,

    signatureDate,

    formNumber,

    submissionId,

    accuracyConsent,

    usageConsent,

    permissions: {

      camera,

      microphone,

      screen
    }
  };
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get(
  "/api/health",
  async (req, res) => {

    let database =
      "not-configured";

    if (pool) {

      try {

        await pool.query(
          "SELECT 1"
        );

        database =
          "postgresql";

      } catch (error) {

        console.error(
          "Database health check failed:",
          error.message
        );

        database =
          "postgresql-error";
      }
    }

    return res.json({

      ok: true,

      service:
        "application-form",

      database,

      time:
        new Date().toISOString()
    });
  }
);

/* =========================================================
   HOME PAGE
========================================================= */

app.get(
  "/",
  (req, res) => {

    return res.sendFile(
      path.join(
        ROOT_DIR,
        "index.html"
      )
    );
  }
);

/* =========================================================
   CREATE APPLICATION
========================================================= */

app.post(
  "/api/applications",

  upload.any(),

  async (req, res) => {

    const requestId =
      crypto.randomUUID();

    try {

      console.log(
        `[${requestId}] Application submission started`
      );

      /*
      -----------------------------------------------------
      DATABASE CHECK
      -----------------------------------------------------
      */

      if (!pool) {

        console.error(
          `[${requestId}] DATABASE_URL missing`
        );

        return res.status(503).json({

          ok: false,

          error:
            "Database is not configured. Add DATABASE_URL to Render Environment Variables.",

          requestId
        });
      }

      /*
      -----------------------------------------------------
      NORMALIZE DATA
      -----------------------------------------------------
      */

      const data =
        normalizeApplication(
          req.body
        );

      /*
      -----------------------------------------------------
      REQUIRED DATA
      -----------------------------------------------------
      */

      /*
       * Only Full Name is mandatory at server level.
       *
       * Other fields are intentionally optional so the
       * universal form can be used for different purposes.
       */

      if (!data.fullName) {

        return res.status(400).json({

          ok: false,

          error:
            "Full Name is required.",

          requestId
        });
      }

      /*
      -----------------------------------------------------
      BASIC EMAIL VALIDATION IF PROVIDED
      -----------------------------------------------------
      */

      if (
        data.email &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          data.email
        )
      ) {

        return res.status(400).json({

          ok: false,

          error:
            "Please enter a valid email address.",

          requestId
        });
      }

      /*
      -----------------------------------------------------
      IDENTIFIERS
      -----------------------------------------------------
      */

      const id =
        crypto.randomUUID();

      const submissionId =
        data.submissionId ||
        makeSubmissionId();

      let finalFormNumber =
        data.formNumber ||
        makeFormNumber();

      const createdAt =
        new Date();

      /*
      -----------------------------------------------------
      APPLICATION DETAILS
      -----------------------------------------------------
      */

      const applicationDetails = {

        fullName:
          data.fullName,

        mobile:
          data.mobile,

        email:
          data.email,

        dateOfBirth:
          data.dob,

        gender:
          data.gender,

        address:
          data.address,

        city:
          data.city,

        state:
          data.state,

        country:
          data.country,

        postalCode:
          data.postalCode,

        occupation:
          data.occupation,

        organization:
          data.organization,

        contactMethod:
          data.contactMethod,

        purpose:
          data.purpose,

        signature:
          data.signature,

        signatureDate:
          data.signatureDate,

        formNumber:
          finalFormNumber,

        submissionId:
          submissionId,

        accuracyConsent:
          data.accuracyConsent,

        usageConsent:
          data.usageConsent
      };

      /*
      -----------------------------------------------------
      FILES
      -----------------------------------------------------
      */

      const files =
        Array.isArray(req.files)
          ? req.files
          : [];

      /*
      -----------------------------------------------------
      PERMISSIONS
      -----------------------------------------------------
      */

      const permissions = {

        camera:
          data.permissions.camera,

        microphone:
          data.permissions.microphone,

        screen:
          data.permissions.screen,

        filesSelected:
          files.length > 0,

        fileCount:
          files.length
      };

      /*
      -----------------------------------------------------
      DATABASE TRANSACTION
      -----------------------------------------------------
      */

      const client =
        await pool.connect();

      try {

        await client.query(
          "BEGIN"
        );

        /*
        ---------------------------------------------------
        INSERT APPLICATION
        ---------------------------------------------------
        */

        let inserted = false;

        /*
         * Retry form number if a collision occurs.
         */

        for (
          let attempt = 0;
          attempt < 3;
          attempt++
        ) {

          try {

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

                data.fullName,

                data.email || null,

                data.mobile || null,

                data.dob || null,

                JSON.stringify(
                  applicationDetails
                ),

                data.notes || null,

                JSON.stringify(
                  permissions
                ),

                createdAt
              ]
            );

            inserted = true;

            break;

          } catch (error) {

            /*
             * PostgreSQL unique violation
             */

            if (
              error.code === "23505" &&
              attempt < 2
            ) {

              finalFormNumber =
                makeFormNumber();

              applicationDetails.formNumber =
                finalFormNumber;

              continue;
            }

            throw error;
          }
        }

        if (!inserted) {

          throw new Error(
            "Unable to create application record."
          );
        }

        /*
        ---------------------------------------------------
        SAVE UPLOADED FILES
        ---------------------------------------------------
        */

        for (
          const file
          of files
        ) {

          const category =
            getFileCategory(
              file
            );

          await client.query(
            `
            INSERT INTO application_files (

              id,

              application_id,

              filename,

              mimetype,

              size,

              file_data,

              file_category

            )

            VALUES (

              $1,

              $2,

              $3,

              $4,

              $5,

              $6,

              $7

            )
            `,

            [

              crypto.randomUUID(),

              id,

              file.originalname,

              file.mimetype,

              file.size,

              file.buffer,

              category
            ]
          );
        }

        await client.query(
          "COMMIT"
        );

      } catch (error) {

        try {

          await client.query(
            "ROLLBACK"
          );

        } catch (rollbackError) {

          console.error(
            "Rollback failed:",
            rollbackError
          );
        }

        throw error;

      } finally {

        client.release();
      }

      /*
      -----------------------------------------------------
      SUCCESS
      -----------------------------------------------------
      */

      console.log(
        `[${requestId}] Application saved: ${finalFormNumber}`
      );

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
            files.map(
              file => ({

                name:
                  file.originalname,

                type:
                  file.mimetype,

                size:
                  file.size,

                category:
                  getFileCategory(
                    file
                  )
              })
            )
        },

        requestId
      });

    } catch (error) {

      console.error(
        `[${requestId}] Application submission failed:`,
        error
      );

      /*
      -----------------------------------------------------
      POSTGRES ERROR INFORMATION
      -----------------------------------------------------
      */

      let message =
        "Unable to save application.";

      if (
        error &&
        error.code === "23505"
      ) {

        message =
          "A duplicate application number was detected. Please submit again.";

      } else if (
        error &&
        error.code === "22P02"
      ) {

        message =
          "Invalid application data was received.";

      } else if (
        error &&
        error.message
      ) {

        /*
         * Don't expose database internals.
         */

        console.error(
          "Internal database message:",
          error.message
        );
      }

      return res.status(500).json({

        ok: false,

        error: message,

        requestId
      });
    }
  }
);

/* =========================================================
   APPLICATION COUNT
========================================================= */

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

      return res.json({

        ok: true,

        count:
          result.rows[0].count
      });

    } catch (error) {

      console.error(
        "Count error:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Unable to count applications."
      });
    }
  }
);

/* =========================================================
   ADMIN LOGIN
========================================================= */

app.post(
  "/api/admin/login",

  (req, res) => {

    const suppliedToken =
      clean(
        req.body?.token
      );

    if (
      !ADMIN_TOKEN
    ) {

      return res.status(503).json({

        ok: false,

        error:
          "ADMIN_TOKEN is not configured on the server."
      });
    }

    if (
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

    return res.json({

      ok: true,

      token:
        sessionToken
    });
  }
);

/* =========================================================
   ADMIN STATUS
========================================================= */

app.get(
  "/api/admin/status",

  requireSession,

  (req, res) => {

    return res.json({

      ok: true,

      authenticated: true
    });
  }
);

/* =========================================================
   ADMIN APPLICATIONS
========================================================= */

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

            form_number
              AS "formNumber",

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

      return res.json({

        ok: true,

        applications:
          result.rows
      });

    } catch (error) {

      console.error(
        "Unable to load applications:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Unable to load applications."
      });
    }
  }
);

/* =========================================================
   ADMIN FILE LIST
========================================================= */

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

            file_category
              AS "fileCategory",

            created_at
              AS "createdAt"

          FROM application_files

          WHERE application_id = $1

          ORDER BY
            created_at ASC
          `,

          [
            req.params.id
          ]
        );

      return res.json({

        ok: true,

        files:
          result.rows
      });

    } catch (error) {

      console.error(
        "Unable to load files:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Unable to load files."
      });
    }
  }
);

/* =========================================================
   DOWNLOAD ADMIN FILE
========================================================= */

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

      /*
       * Safe attachment filename.
       */

      const safeFilename =
        String(
          file.filename
        )
        .replace(
          /["\\\r\n]/g,
          "_"
        );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${safeFilename}"`
      );

      return res.send(
        file.file_data
      );

    } catch (error) {

      console.error(
        "File download failed:",
        error
      );

      return res.status(500).json({

        ok: false,

        error:
          "Unable to download file."
      });
    }
  }
);

/* =========================================================
   API 404
========================================================= */

app.use(
  "/api",

  (req, res) => {

    return res.status(404).json({

      ok: false,

      error:
        "API endpoint not found."
    });
  }
);

/* =========================================================
   MULTER ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {

    if (
      error instanceof multer.MulterError
    ) {

      console.error(
        "Multer error:",
        error
      );

      return res.status(400).json({

        ok: false,

        error:
          "File upload error: " +
          error.message
      });
    }

    return next(error);
  }
);

/* =========================================================
   GENERAL ERROR HANDLER
========================================================= */

app.use(
  (error, req, res, next) => {

    console.error(
      "Server error:",
      error
    );

    return res.status(500).json({

      ok: false,

      error:
        "Internal server error."
    });
  }
);

/* =========================================================
   START SERVER
========================================================= */

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

        console.log(
          `Health check: /api/health`
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