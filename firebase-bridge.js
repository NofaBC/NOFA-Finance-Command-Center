(function () {
  'use strict';

  var app = null;
  var auth = null;
  var db = null;
  var currentUser = null;
  var callbacks = {};
  var saveTimer = null;
  var statusEl = null;
  var started = false;

  function configured() {
    var c = window.NOFA_FIREBASE_CONFIG || {};
    return !!(c.apiKey && c.projectId && c.appId &&
      String(c.apiKey).indexOf('YOUR_') !== 0 &&
      String(c.projectId).indexOf('YOUR_') !== 0 &&
      String(c.appId).indexOf('YOUR_') !== 0);
  }

  function emitStatus(status) {
    if (callbacks.onStatus) callbacks.onStatus(status);
    paintStatus(status);
  }

  function ensureStatusElement() {
    if (statusEl) return statusEl;
    statusEl = document.createElement('button');
    statusEl.type = 'button';
    statusEl.id = 'nofa-cloud-status';
    statusEl.setAttribute('aria-label', 'Firebase cloud status');
    statusEl.style.cssText = [
      'position:fixed','right:18px','bottom:18px','z-index:120',
      'border:1px solid rgba(255,255,255,.24)','border-radius:999px',
      'padding:9px 13px','font:600 12px/1.2 Inter,system-ui,sans-serif',
      'box-shadow:0 12px 28px rgba(7,29,53,.22)','cursor:pointer',
      'backdrop-filter:blur(10px)','transition:.2s ease'
    ].join(';');
    statusEl.addEventListener('click', function () {
      if (!configured()) {
        alert('Firebase is not configured yet. Add the Firebase web app values to firebase-config.js, then redeploy.');
        return;
      }
      if (!currentUser) {
        signIn();
      } else if (confirm('Signed in as ' + (currentUser.email || 'Firebase user') + '. Sign out of cloud sync?')) {
        signOut();
      }
    });
    document.body.appendChild(statusEl);
    return statusEl;
  }

  function paintStatus(status) {
    var el = ensureStatusElement();
    if (status === 'synced') {
      el.textContent = '● Cloud synced';
      el.style.background = 'rgba(10,49,85,.94)';
      el.style.color = '#fff';
    } else if (status === 'signed-out') {
      el.textContent = '○ Connect Firebase';
      el.style.background = 'rgba(255,255,255,.94)';
      el.style.color = '#1f4fc4';
    } else if (status === 'syncing') {
      el.textContent = '↻ Syncing…';
      el.style.background = 'rgba(255,255,255,.94)';
      el.style.color = '#475569';
    } else if (status === 'error') {
      el.textContent = '! Cloud sync error';
      el.style.background = '#fff1f2';
      el.style.color = '#be123c';
    } else {
      el.textContent = '○ Local only';
      el.style.background = 'rgba(255,255,255,.94)';
      el.style.color = '#64748b';
    }
  }

  function stateDoc(uid) {
    return db.collection('users').doc(uid).collection('app').doc('state');
  }

  function loadCloudState() {
    if (!currentUser || !db) return Promise.resolve(null);
    emitStatus('syncing');
    return stateDoc(currentUser.uid).get().then(function (snap) {
      if (snap.exists) {
        var data = snap.data() || {};
        if (data.store && callbacks.onCloudState) callbacks.onCloudState(data.store);
        emitStatus('synced');
        return data.store || null;
      }
      var localStore = callbacks.getStore ? callbacks.getStore() : null;
      if (localStore) return saveStore(localStore).then(function () { return localStore; });
      emitStatus('synced');
      return null;
    }).catch(function (err) {
      console.error('Firebase load failed', err);
      emitStatus('error');
      throw err;
    });
  }

  function saveStoreNow(store) {
    if (!currentUser || !db) return Promise.resolve(false);
    emitStatus('syncing');
    return stateDoc(currentUser.uid).set({
      store: store,
      schemaVersion: store && store.v ? store.v : null,
      updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true }).then(function () {
      emitStatus('synced');
      return true;
    }).catch(function (err) {
      console.error('Firebase save failed', err);
      emitStatus('error');
      throw err;
    });
  }

  function saveStore(store) {
    return new Promise(function (resolve, reject) {
      if (!currentUser || !db) { resolve(false); return; }
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        saveStoreNow(store).then(resolve).catch(reject);
      }, 450);
    });
  }

  function signIn() {
    if (!auth) return Promise.reject(new Error('Firebase Auth is not initialized.'));
    var provider = new firebase.auth.GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    return auth.signInWithPopup(provider);
  }

  function signOut() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  function start(opts) {
    callbacks = opts || {};
    ensureStatusElement();
    if (started) return;
    started = true;

    if (!configured()) {
      emitStatus('local');
      return;
    }
    if (!window.firebase) {
      console.error('Firebase SDK scripts are not loaded.');
      emitStatus('error');
      return;
    }

    try {
      app = firebase.apps && firebase.apps.length ? firebase.app() : firebase.initializeApp(window.NOFA_FIREBASE_CONFIG);
      auth = firebase.auth();
      db = firebase.firestore();
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(function (err) {
        console.warn('Could not set Firebase auth persistence', err);
      });
      auth.onAuthStateChanged(function (user) {
        currentUser = user || null;
        if (!user) {
          emitStatus('signed-out');
          return;
        }
        loadCloudState();
      });
    } catch (err) {
      console.error('Firebase initialization failed', err);
      emitStatus('error');
    }
  }

  window.NOFAFirebase = {
    start: start,
    configured: configured,
    isSignedIn: function () { return !!currentUser; },
    currentUser: function () { return currentUser; },
    signIn: signIn,
    signOut: signOut,
    loadCloudState: loadCloudState,
    saveStore: saveStore
  };
})();
