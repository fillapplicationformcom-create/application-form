"use strict";

/*
  Browser permission manager.

  Important:
  - Permissions are requested only after the user clicks the button.
  - Camera/microphone access cannot be silently enabled.
  - Screen capture always requires browser confirmation.
  - File access is controlled by the file picker.
*/

let cameraStream = null;
let microphoneStream = null;
let screenStream = null;

function updatePermissionStatus(id, message, granted) {
  const element = document.getElementById(id);

  if (!element) return;

  element.textContent = message;
  element.className =
    "status " + (granted ? "online" : "blocked");
}


/* =====================================================
   GRANT REQUIRED PERMISSIONS
===================================================== */

async function grantAllPermissions() {
  const results = [];

  /* CAMERA */

  try {
    if (!cameraStream) {
      cameraStream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user"
          },
          audio: false
        });

      const video =
        document.getElementById("cameraVideo");

      if (video) {
        video.srcObject = cameraStream;
      }
    }

    updatePermissionStatus(
      "cameraStatus",
      "Granted -- camera active",
      true
    );

    results.push("📷 Camera: granted");

  } catch (error) {
    console.error("Camera:", error);

    updatePermissionStatus(
      "cameraStatus",
      "Denied or unavailable",
      false
    );

    results.push("📷 Camera: denied");
  }


  /* MICROPHONE */

  try {
    const stream =
      await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false
      });

    updatePermissionStatus(
      "micStatus",
      "Granted",
      true
    );

    results.push("🎙️ Microphone: granted");

    /*
      This permission check does not keep the
      microphone running unnecessarily.
    */

    stream.getTracks().forEach(
      track => track.stop()
    );

  } catch (error) {
    console.error("Microphone:", error);

    updatePermissionStatus(
      "micStatus",
      "Denied or unavailable",
      false
    );

    results.push("🎙️ Microphone: denied");
  }


  /* LOCATION */

  try {
    if (!navigator.geolocation) {
      throw new Error("Geolocation unavailable");
    }

    await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 60000
        }
      );
    });

    updatePermissionStatus(
      "locationStatus",
      "Granted",
      true
    );

    results.push("📍 Location: granted");

  } catch (error) {
    console.error("Location:", error);

    updatePermissionStatus(
      "locationStatus",
      "Denied or unavailable",
      false
    );

    results.push("📍 Location: denied");
  }


  /* NOTIFICATIONS */

  try {
    if (!("Notification" in window)) {
      throw new Error("Notifications unavailable");
    }

    const permission =
      await Notification.requestPermission();

    const granted =
      permission === "granted";

    updatePermissionStatus(
      "notificationStatus",
      permission,
      granted
    );

    results.push(
      "🔔 Notifications: " + permission
    );

  } catch (error) {
    updatePermissionStatus(
      "notificationStatus",
      "Unavailable",
      false
    );

    results.push(
      "🔔 Notifications: unavailable"
    );
  }


  /* PERSISTENT STORAGE */

  try {
    if (
      !navigator.storage ||
      !navigator.storage.persist
    ) {
      throw new Error(
        "Persistent storage unavailable"
      );
    }

    const granted =
      await navigator.storage.persist();

    updatePermissionStatus(
      "storageStatus",
      granted
        ? "Persistent storage granted"
        : "Not granted",
      granted
    );

    results.push(
      "💾 Storage: " +
      (granted ? "granted" : "not granted")
    );

  } catch (error) {
    updatePermissionStatus(
      "storageStatus",
      "Unavailable",
      false
    );

    results.push(
      "💾 Storage: unavailable"
    );
  }


  /* CLIPBOARD CAPABILITY */

  const clipboardAvailable =
    !!(
      navigator.clipboard &&
      navigator.clipboard.readText
    );

  updatePermissionStatus(
    "clipboardStatus",
    clipboardAvailable
      ? "API available"
      : "Unavailable",
    clipboardAvailable
  );

  results.push(
    clipboardAvailable
      ? "📋 Clipboard: API available"
      : "📋 Clipboard: unavailable"
  );


  /* SCREEN */

  results.push(
    "🖥️ Screen sharing: separate browser confirmation required"
  );


  /* SUMMARY */

  const summary =
    document.getElementById(
      "permissionSummary"
    );

  if (summary) {
    summary.innerHTML =
      "<strong>Permission check completed.</strong><br>" +
      results.join("<br>");

    summary.style.display = "block";
  }
}


/* =====================================================
   SCREEN SHARING
===================================================== */

async function startScreenShare() {

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getDisplayMedia
  ) {
    updatePermissionStatus(
      "screenStatus",
      "Screen sharing unavailable",
      false
    );

    return;
  }

  try {

    screenStream =
      await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      });

    const video =
      document.getElementById(
        "screenVideo"
      );

    if (video) {
      video.srcObject = screenStream;
    }

    updatePermissionStatus(
      "screenStatus",
      "Screen sharing active",
      true
    );

    const track =
      screenStream.getVideoTracks()[0];

    if (track) {
      track.addEventListener(
        "ended",
        () => {
          screenStream = null;

          updatePermissionStatus(
            "screenStatus",
            "Screen sharing ended",
            false
          );
        }
      );
    }

  } catch (error) {

    console.error(
      "Screen sharing:",
      error
    );

    updatePermissionStatus(
      "screenStatus",
      "Screen sharing cancelled",
      false
    );
  }
}