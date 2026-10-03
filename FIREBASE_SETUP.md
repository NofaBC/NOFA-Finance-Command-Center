# Firebase Setup — NOFA Finance Command Center

The dashboard is designed to run on Vercel while Firebase provides Authentication and Firestore persistence.

## 1. Create or select a Firebase project
In Firebase Console, create a project dedicated to the NOFA Finance Command Center, or select the project you want to use.

## 2. Register a Web app
Firebase Console → Project Settings → Your apps → Add app → Web.

Copy the Firebase web configuration and replace the placeholder values in `firebase-config.js`.

The Firebase web configuration identifies the Firebase project; it is not a bank credential. Access to financial data is protected by Firebase Authentication and Firestore Security Rules.

## 3. Enable Authentication
Firebase Console → Authentication → Sign-in method → Google → Enable.

Add these Authorized Domains:
- `nofa-finance-command-center.vercel.app`
- `localhost` for local testing

Only authenticated users can access their own Firestore record under `users/{uid}/app/state`.

## 4. Create Firestore
Firebase Console → Firestore Database → Create database.

Use Production mode. Do not leave the database in open test mode.

## 5. Publish the security rules
Use the included `firestore.rules` file.

With Firebase CLI:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules
```

Or copy the rules into Firebase Console → Firestore → Rules and publish them.

## 6. Deploy the frontend
Commit the Firebase files to GitHub. Vercel should redeploy automatically from the connected repository.

The dashboard works in two modes:
- Firebase configured + signed in → local changes are synced to Firestore.
- Firebase not configured or signed out → the existing localStorage behavior remains available.

## 7. First sign-in behavior
On first successful Google sign-in:
- If Firestore already contains a state document, the cloud state loads into the dashboard.
- If no cloud state exists, the current local dashboard state becomes the initial Firestore state.

After that, edits are written to localStorage immediately and debounced to Firestore.

## Current Firestore path

```text
users/{firebaseAuthUid}/app/state
```

Document fields:
- `store` — the complete current application state
- `schemaVersion` — current state schema version
- `updatedAt` — Firestore server timestamp

## Security notes
- Do not put bank usernames, passwords, MFA codes, or bank API secrets in the repository or Firestore.
- This integration does not connect directly to a bank.
- Future screenshot ingestion should upload only the screenshots the user intentionally selects and should require review/approval before transactions are committed.
- If the repository remains public, never commit service-account JSON files, private keys, Stripe secret keys, OpenAI keys, or other server secrets.
