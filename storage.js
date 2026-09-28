"use strict";

const DB_NAME = "ApplicationFormDB";
const DB_VERSION = 1;

const APPLICATION_STORE = "applications";
const FILE_STORE = "files";

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(APPLICATION_STORE)) {
        db.createObjectStore(APPLICATION_STORE, {
          keyPath: "id",
          autoIncrement: true
        });
      }

      if (!db.objectStoreNames.contains(FILE_STORE)) {
        db.createObjectStore(FILE_STORE, {
          keyPath: "id",
          autoIncrement: true
        });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveApplicationRecord(application) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(APPLICATION_STORE, "readwrite");
    const store = tx.objectStore(APPLICATION_STORE);

    const request = store.add(application);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveApplicationFile(file, applicationId) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");
    const store = tx.objectStore(FILE_STORE);

    store.add({
      applicationId,
      name: file.name,
      type: file.type,
      size: file.size,
      createdAt: new Date().toISOString(),
      blob: file
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function saveBlobToIndexedDB(blob, name, type, applicationId = null) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(FILE_STORE, "readwrite");

    tx.objectStore(FILE_STORE).add({
      applicationId,
      name,
      type,
      size: blob.size,
      createdAt: new Date().toISOString(),
      blob
    });

    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}