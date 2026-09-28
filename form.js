"use strict";

/* =====================================================
   APPLICATION CONFIGURATION
===================================================== */

const APPLICATION_FIELDS = {

  "Education - UG": [
    ["Course", "course", "text"],
    ["University / College", "institution", "text"],
    ["Entrance Exam", "entranceExam", "text"],
    ["Application / Roll Number", "applicationNumber", "text"]
  ],

  "Education - PG": [
    ["Course / Specialization", "course", "text"],
    ["University / College", "institution", "text"],
    ["Entrance Exam", "entranceExam", "text"],
    ["Application / Roll Number", "applicationNumber", "text"]
  ],

  "NEET UG": [
    ["NEET Application Number", "neetApplicationNumber", "text"],
    ["NEET Score", "neetScore", "number"],
    ["NEET Rank", "neetRank", "number"],
    ["Category", "category", "text"],
    ["Preferred Course", "course", "text"]
  ],

  "NEET PG": [
    ["NEET PG Application Number", "neetApplicationNumber", "text"],
    ["NEET PG Score", "neetScore", "number"],
    ["NEET PG Rank", "neetRank", "number"],
    ["Category", "category", "text"],
    ["Preferred Specialization", "specialization", "text"]
  ],

  "Job / Recruitment": [
    ["Current Qualification", "qualification", "text"],
    ["Job Role", "jobRole", "text"],
    ["Experience", "experience", "text"],
    ["Current / Previous Employer", "employer", "text"]
  ],

  "Business": [
    ["Business Name", "businessName", "text"],
    ["Business Type", "businessType", "text"],
    ["Registration Number", "registrationNumber", "text"],
    ["Business Address", "businessAddress", "text"]
  ],

  "Banking / Financial Application": [
    ["Application Purpose", "financialPurpose", "text"],
    ["Occupation", "occupation", "text"],
    ["Annual Income", "annualIncome", "number"],
    ["Bank / Institution", "bankName", "text"]
  ]
};


/* =====================================================
   DYNAMIC APPLICATION FIELDS
===================================================== */

function createDynamicFields(type) {

  const existing =
    document.getElementById(
      "dynamicApplicationFields"
    );

  if (existing) {
    existing.remove();
  }

  const fields =
    APPLICATION_FIELDS[type];

  if (!fields || !fields.length) {
    return;
  }

  const section =
    document.createElement("section");

  section.className = "card";
  section.id = "dynamicApplicationFields";

  const heading =
    document.createElement("h2");

  heading.textContent =
    type + " Details";

  section.appendChild(heading);

  const grid =
    document.createElement("div");

  grid.className = "grid";

  fields.forEach(
    ([labelText, id, inputType]) => {

      const wrapper =
        document.createElement("div");

      const label =
        document.createElement("label");

      label.htmlFor = id;
      label.textContent = labelText;

      const input =
        document.createElement("input");

      input.id = id;
      input.name = id;
      input.type = inputType;

      if (inputType === "number") {
        input.min = "0";
      }

      wrapper.appendChild(label);
      wrapper.appendChild(input);

      grid.appendChild(wrapper);
    }
  );

  section.appendChild(grid);

  const container =
    document.querySelector(".container");

  const applicantSection =
    container.children[1];

  container.insertBefore(
    section,
    applicantSection.nextSibling
  );
}


/* =====================================================
   COLLECT DYNAMIC DATA
===================================================== */

function collectDynamicFields() {

  const data = {};

  const section =
    document.getElementById(
      "dynamicApplicationFields"
    );

  if (!section) {
    return data;
  }

  section
    .querySelectorAll("input")
    .forEach(input => {

      data[input.id] =
        input.value.trim();
    });

  return data;
}


/* =====================================================
   FILE HANDLING
===================================================== */

async function storeSelectedFilesForApplication(
  applicationId
) {

  const input =
    document.getElementById(
      "fileInput"
    );

  if (!input || !input.files.length) {
    return;
  }

  for (const file of input.files) {

    await saveApplicationFile(
      file,
      applicationId
    );
  }

  input.value = "";
}


/* =====================================================
   SAVE APPLICATION
===================================================== */

async function saveApplication() {

  const applicationType =
    document.getElementById(
      "applicationType"
    ).value;

  const fullName =
    document.getElementById(
      "fullName"
    ).value.trim();

  const email =
    document.getElementById(
      "email"
    ).value.trim();

  const phone =
    document.getElementById(
      "phone"
    ).value.trim();

  const dob =
    document.getElementById(
      "dob"
    ).value;

  const notes =
    document.getElementById(
      "notes"
    ).value.trim();


  /* BASIC VALIDATION */

  if (!applicationType) {
    alert(
      "Please select an application type."
    );
    return;
  }

  if (!fullName) {
    alert(
      "Please enter the applicant's name."
    );
    return;
  }

  if (!email) {
    alert(
      "Please enter an email address."
    );
    return;
  }


  /* BUILD RECORD */

  const application = {

    applicationType,

    applicant: {
      fullName,
      email,
      phone,
      dob
    },

    applicationDetails:
      collectDynamicFields(),

    notes,

    createdAt:
      new Date().toISOString()
  };


  try {

    const applicationId =
      await saveApplicationRecord(
        application
      );


    await storeSelectedFilesForApplication(
      applicationId
    );


    /* SAVE A LIGHTWEIGHT LOCAL COPY */

    localStorage.setItem(
      "lastApplication",
      JSON.stringify({
        id: applicationId,
        applicationType,
        fullName,
        createdAt:
          application.createdAt
      })
    );


    const message =
      document.getElementById(
        "saveMessage"
      );

    if (message) {

      message.textContent =
        `Application #${applicationId} saved successfully.`;

      message.style.display =
        "block";
    }


    if (
      typeof displayStoredFiles ===
      "function"
    ) {
      await displayStoredFiles();
    }

  } catch (error) {

    console.error(
      "Application save failed:",
      error
    );

    alert(
      "Unable to save the application."
    );
  }
}


/* =====================================================
   FORM RESET
===================================================== */

function clearApplication() {

  const confirmed =
    window.confirm(
      "Clear the current application form?"
    );

  if (!confirmed) {
    return;
  }

  document
    .querySelectorAll(
      "input, textarea"
    )
    .forEach(element => {

      if (
        element.type !== "file"
      ) {
        element.value = "";
      }
    });


  const type =
    document.getElementById(
      "applicationType"
    );

  if (type) {
    type.value = "";
  }


  const dynamic =
    document.getElementById(
      "dynamicApplicationFields"
    );

  if (dynamic) {
    dynamic.remove();
  }


  const message =
    document.getElementById(
      "saveMessage"
    );

  if (message) {
    message.style.display = "none";
  }
}


/* =====================================================
   APPLICATION TYPE CHANGE
===================================================== */

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const selector =
      document.getElementById(
        "applicationType"
      );

    if (!selector) {
      return;
    }

    selector.addEventListener(
      "change",
      event => {

        createDynamicFields(
          event.target.value
        );
      }
    );
  }
);