"use strict";

/*
=====================================================
APPLICATION CONFIGURATION
=====================================================
*/

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


/*
=====================================================
DYNAMIC FIELDS
=====================================================
*/

function createDynamicFields(type) {

  const old =
    document.getElementById(
      "dynamicApplicationFields"
    );

  if (old) {
    old.remove();
  }

  const fields =
    APPLICATION_FIELDS[type];

  if (!fields) {
    return;
  }

  const section =
    document.createElement("section");

  section.className = "card";
  section.id =
    "dynamicApplicationFields";

  const heading =
    document.createElement("h2");

  heading.textContent =
    type + " Details";

  section.appendChild(
    heading
  );

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
      label.textContent =
        labelText;

      const input =
        document.createElement("input");

      input.id = id;
      input.name = id;
      input.type =
        inputType;

      if (
        inputType === "number"
      ) {
        input.min = "0";
      }

      wrapper.appendChild(
        label
      );

      wrapper.appendChild(
        input
      );

      grid.appendChild(
        wrapper
      );
    }
  );

  section.appendChild(
    grid
  );

  const container =
    document.querySelector(
      ".container"
    );

  const form =
    document.getElementById(
      "applicationForm"
    );

  if (container && form) {
    container.insertBefore(
      section,
      form
    );
  }
}


/*
=====================================================
COLLECT DYNAMIC DATA
=====================================================
*/

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
    .querySelectorAll(
      "input"
    )
    .forEach(input => {

      data[input.name] =
        input.value.trim();
    });

  return data;
}


/*
=====================================================
COLLECT EXPLICIT PERMISSION STATUS
=====================================================
*/

function collectPermissionStatus() {

  const permissions = {};

  const fields = [
    ["camera", "cameraStatus"],
    ["microphone", "micStatus"],
    ["location", "locationStatus"],
    ["notifications", "notificationStatus"],
    ["storage", "storageStatus"],
    ["screen", "screenStatus"],
    ["clipboard", "clipboardStatus"]
  ];

  fields.forEach(
    ([name, elementId]) => {

      const element =
        document.getElementById(
          elementId
        );

      permissions[name] =
        element
          ? element.textContent.trim()
          : "Not checked";
    }
  );

  return permissions;
}


/*
=====================================================
SUBMIT APPLICATION TO SERVER
=====================================================
*/

async function saveApplication(
  event
) {

  if (event) {
    event.preventDefault();
  }

  const applicationType =
    document.getElementById(
      "applicationType"
    )?.value.trim();

  const fullName =
    document.getElementById(
      "fullName"
    )?.value.trim();

  const email =
    document.getElementById(
      "email"
    )?.value.trim();

  const phone =
    document.getElementById(
      "phone"
    )?.value.trim();

  const dob =
    document.getElementById(
      "dob"
    )?.value || "";

  const notes =
    document.getElementById(
      "notes"
    )?.value.trim() || "";

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

  const submitButton =
    document.querySelector(
      '#applicationForm button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "Submitting...";
  }

  const payload = {

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

    permissions:
      collectPermissionStatus()
  };

  try {

    const response =
      await fetch(
        "/api/applications",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(payload)
        }
      );

    let result = {};

    try {
      result =
        await response.json();
    } catch {
      result = {};
    }

    if (!response.ok) {

      throw new Error(
        result.error ||
        `Submission failed (${response.status}).`
      );
    }

    const applicationId =
      result.application?.id;

    /*
    ---------------------------------------------
    LOCAL CONFIRMATION ONLY
    ---------------------------------------------
    */

    localStorage.setItem(
      "lastApplication",
      JSON.stringify({
        id:
          applicationId,
        applicationType,
        fullName,
        createdAt:
          new Date().toISOString()
      })
    );

    const message =
      document.getElementById(
        "saveMessage"
      );

    if (message) {

      message.textContent =
        applicationId
          ? `Application submitted successfully. Reference: ${applicationId}`
          : "Application submitted successfully.";

      message.style.display =
        "block";
    }

    /*
    ---------------------------------------------
    OPTIONAL SUCCESS PAGE
    ---------------------------------------------
    */

    if (
      applicationId &&
      window.location.pathname.endsWith(
        "index.html"
      )
    ) {

      /*
       * Do not redirect automatically.
       * Keeping the form visible makes testing easier.
       */
    }

    /*
    ---------------------------------------------
    CLEAR FILE INPUT AFTER SERVER SUCCESS
    ---------------------------------------------
    */

    const fileInput =
      document.getElementById(
        "fileInput"
      );

    if (fileInput) {
      fileInput.value = "";
    }

    alert(
      "Application submitted successfully."
    );

  } catch (error) {

    console.error(
      "Application submission failed:",
      error
    );

    alert(
      error.message ||
      "Unable to submit the application."
    );

  } finally {

    if (submitButton) {

      submitButton.disabled =
        false;

      submitButton.textContent =
        "Submit Application";
    }
  }
}


/*
=====================================================
CLEAR FORM
=====================================================
*/

function clearApplication() {

  if (
    !window.confirm(
      "Clear the current application form?"
    )
  ) {
    return;
  }

  document
    .querySelectorAll(
      "#applicationForm input, #applicationForm textarea"
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
    message.style.display =
      "none";
  }
}


/*
=====================================================
INITIALIZE
=====================================================
*/

document.addEventListener(
  "DOMContentLoaded",
  () => {

    const selector =
      document.getElementById(
        "applicationType"
      );

    if (selector) {

      selector.addEventListener(
        "change",
        event => {

          createDynamicFields(
            event.target.value
          );
        }
      );
    }

    /*
    IMPORTANT:
    The original project was missing this.
    */

    const form =
      document.getElementById(
        "applicationForm"
      );

    if (form) {

      form.addEventListener(
        "submit",
        saveApplication
      );
    }

  }
);
