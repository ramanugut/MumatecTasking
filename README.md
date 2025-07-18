# Mumatec Tasking

Simple task manager app with Firebase authentication and Firestore storage.

The task modal now includes a **Project** selector. Projects can be created on
the fly and may define a type (e.g. *software* or *marketing*) which controls
which fields are shown when creating issues.

The account **mumatechosting@gmail.com** is considered the super administrator
and always has full rights to manage other users.

## Setup

1. Install dependencies with `npm install`.
2. Initialize Firestore collections with `npm run init:collections` (requires a
   Firebase service account key). The script now provisions additional
   collections for comments, activity logs, attachments, and time tracking.
3. Start the dev server using `npm run dev` (uses `serve` under the hood).
4. Visit `login.html` to sign in with your admin credentials.
5. If you do not have an account, use `signup.html` which will create a client
   profile.
   You can also provide an invitation token during sign up to automatically
   assign a role and project.
6. After signing in you will be redirected to `index.html` where you can manage
   your tasks.
7. Administrators can manage pending invitations via `invite.html`.
8. Roles can be created in `roles-admin.html` and assigned to users through
   `user-management.html`.
9. Departments and teams can be edited in `departments.html`.

Firebase is pre-configured with project **mumatectasking**. Update `firebase.js`
 if you need to change configuration.

Tasks are stored in **Firebase Firestore** so they sync across devices. Offline
changes are queued and saved once connectivity returns.

### Firebase Authorized Domains

If you deploy the app to an external site such as **GitHub Pages**, add that
domain to Firebase Authentication's allowed list. In the Firebase console open
**Authentication**, select **Settings**, and enter your site under
**Authorized domains**.

## Usage Notes

- When dragging a task, keeping the pointer near the viewport edges will
  automatically scroll the kanban board left or right and the page up or down.
  Move away from the edge or finish the drag to stop scrolling.
- Use the arrows in each column or row header to reorder statuses. Your
  preferred order is saved locally and applied on reload.
- Category links in the sidebar also have up/down arrows. Rearrange them to
  suit your workflow and the order will persist across sessions.

### Simplified Version

Previous releases included extensive administrative tools and custom roles.
The simplified build now reintroduces a lightweight profile page for updating
personal details, preferred language, timezone and security options such as
password reset and two-factor authentication. Other advanced features remain
omitted so the app stays focused on basic authentication and task management.

## Workflow Documentation
For an overview of task statuses, priorities, and categories, see [WORKFLOW.md](./WORKFLOW.md).
