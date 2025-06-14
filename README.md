# Mumatec Tasking

Simple task manager app with Firebase authentication and Firestore storage.

The account **mumatechosting@gmail.com** is considered the super administrator
and always has full rights to manage other users.

## Setup

1. Install dependencies with `npm install`.
2. Start the dev server using `npm run dev` (uses `serve` under the hood).
3. Visit `login.html` to sign in with your admin credentials.
4. If you do not have an account, use `signup.html` which will create a client
   profile and take you through onboarding.
5. After signing in you will be redirected to `index.html` where you can manage
   your tasks.

Firebase is pre-configured with project **mumatectasking**. Update `firebase.js`
 if you need to change configuration.

Tasks are stored in **Firebase Firestore** so they sync across devices. Offline
changes are queued and saved once connectivity returns.

## Usage Notes

- When dragging a task, keeping the pointer near the viewport edges will
  automatically scroll the kanban board left or right and the page up or down.
  Move away from the edge or finish the drag to stop scrolling.
- Use the arrows in each column or row header to reorder statuses. Your
  preferred order is saved locally and applied on reload.
- Category links in the sidebar also have up/down arrows. Rearrange them to
  suit your workflow and the order will persist across sessions.

### Admin features

Admins can now:

- Create and delete users
- Grant or revoke admin rights
- Edit any user's email or display name
- Generate password reset links for users
- Activate or deactivate accounts
- Impersonate users
- Bulk update roles and invite users via CSV
- Invite individual users with pre-assigned roles
- Temporary guest access with automatic expiration
- View audit logs of all admin actions
- Manage teams, projects and client assignments

The admin panel is mobile-friendly. Swipe left on a user row to delete and
swipe right to quickly disable or enable accounts. Push notifications alert
admins of new user requests, and a service worker caches admin pages for
offline management.

### Advanced Admin Features

Admins can also configure organization branding and domain restrictions, set
security policies like password requirements and session timeouts, manage API
keys and webhooks, export user data for backups, and handle GDPR data requests
along with audit log exports.

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



### Custom Role Builder

Administrators can define additional roles with granular permissions using the new
**Custom Role Builder** available from the admin panel. Roles can specify
Create/Read/Update/Delete rights for Projects, Tasks, Users, Reports, Settings,
Billing and Client Data. Resource level access can be limited to specific
projects or clients and features may be toggled on or off per role.

## User Invitation & Onboarding

Admins can send invites directly from `invite.html`. Invited users receive a password
reset link and are assigned a role before their first login. Temporary guest
accounts can include an expiration date. New users are guided through an
onboarding checklist on first login and clients are shown a separate tutorial.


## Workflow Documentation
For an overview of task statuses, priorities, and categories, see [WORKFLOW.md](./WORKFLOW.md).
