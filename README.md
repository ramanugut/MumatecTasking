# Mumatec Tasking

Simple task manager app with Firebase authentication and Firestore storage.

The account **mumatechosting@gmail.com** is considered the super administrator
and always has full rights to manage other users.

## Setup

1. Serve the files using any static server (e.g. `npx serve`).
2. Visit `login.html` to sign in with your admin credentials.
3. After signing in you will be redirected to `index.html` where you can manage
your tasks.

Firebase is pre-configured with project **mumatectasking**. Update `firebase.js`
 if you need to change configuration.

Tasks are stored in **Firebase Firestore** so they sync across devices. Offline
changes are queued and saved once connectivity returns.

### Admin features

Admins can now:

- Create and delete users
- Grant or revoke admin rights
- Edit any user's email or display name
- Generate password reset links for users
- Activate or deactivate accounts
- Impersonate users
- Bulk update roles and invite users via CSV
- View audit logs of all admin actions
- Manage teams, projects and client assignments

### User profile features

The profile page now supports avatar upload with cropping and extended details
like job title, phone, timezone, skills, availability status and granular
notification settings. Password changes are also available from the profile
screen.

### Role-Based Access Control

The application defines the following roles:

- **superAdmin** – full system access including user management and billing.
- **admin** – project management, inviting users and managing clients.
- **projectManager** – manage assigned projects and assign tasks.
- **teamLead** – lead teams and approve work.
- **developer** – perform technical tasks and track time.
- **designer** – handle design tasks and manage assets.
- **client** – view only their own projects.
- **guest** – limited read-only access.

Organization admins can access the new **Organization Management** page at
`org.html` to create teams, assign projects and link clients to users.

## Workflow Documentation
For an overview of task statuses, priorities, and categories, see [WORKFLOW.md](./WORKFLOW.md).
