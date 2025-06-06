# Mumatec Tasking

Simple task manager app with Firebase authentication and Firestore storage.

The account **mumatechosting@gmail.com** is considered the super administrator
and always has full rights to manage other users.

## Setup

1. Serve the files using any static server (e.g. `npx serve`).
2. Visit `login.html` to sign in with your admin credentials.
3. After signing in you will be redirected to `index.html` where you can manage your tasks.

Firebase is pre-configured with project **mumatectasking**. Update `firebase.js` if you need to change configuration.

Tasks are stored in **Firebase Firestore** so they sync across devices. Offline changes are queued and saved once connectivity returns.

### Admin features

Admins can now:

- Create and delete users
- Grant or revoke admin rights
- Edit any user's email or display name
- Generate password reset links for users


## Workflow Documentation
For an overview of task statuses, priorities, and categories, see [WORKFLOW.md](./WORKFLOW.md).
