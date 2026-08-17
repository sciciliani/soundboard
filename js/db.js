/* Minimal IndexedDB wrapper for remembering *references* to local files a
   user picked on their own device (via the File System Access API), so a
   button can find the same file again after a reload.

   Deliberately does NOT store file content: only a FileSystemFileHandle
   (a capability/reference the browser re-checks permission for) is kept.
   Nothing about the file itself — its bytes — ever leaves the device or
   gets duplicated into app storage. On browsers without File System
   Access support, local picks are session-only (see app.js) and nothing
   is written here at all. */

var BotoneraDB = (function () {
  var DB_NAME = "botonera-db";
  var STORE = "handles";
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, 2);
      req.onupgradeneeded = function (e) {
        var db = req.result;
        if (db.objectStoreNames.contains("sounds")) db.deleteObjectStore("sounds");
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function putHandle(id, handle) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(handle, id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function getHandle(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readonly");
        var req = tx.objectStore(STORE).get(id);
        req.onsuccess = function () { resolve(req.result || null); };
        req.onerror = function () { reject(req.error); };
      });
    });
  }

  function deleteHandle(id) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).delete(id);
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  function clearAll() {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).clear();
        tx.oncomplete = function () { resolve(); };
        tx.onerror = function () { reject(tx.error); };
      });
    });
  }

  return { putHandle: putHandle, getHandle: getHandle, deleteHandle: deleteHandle, clearAll: clearAll };
})();
