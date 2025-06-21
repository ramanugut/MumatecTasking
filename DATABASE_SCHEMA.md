# Database Schema Overview

This document lists the Firestore collections used by the application and the main fields for each document. Fields marked *optional* may not be present on every record.

## users (collection)
- **email**: string
- **displayName/name**: string
- **role**: string (`superAdmin`, `admin`, `projectManager`, `teamLead`, `developer`, `designer`, `client`, `guest`)
- **createdAt**: timestamp
- **photoURL**: string *(optional)*
- **jobTitle**: string *(optional)*
- **department**: string *(optional)*
- **team**: string *(optional)*
- **phone**: string *(optional)*
- **timezone**: string *(optional)*
- **language**: string *(optional)*
- **skills**: array of strings *(optional)*
- **status**: string *(optional)*
- **notifications**: { email: boolean, push: boolean } *(optional)*
- **onboarded**: boolean *(optional)*
- **disabled**: boolean *(optional)*
- **guestExpiresAt**: timestamp *(optional)*
- **totpSecret**: string *(optional)*
- **lastLogin**: timestamp *(optional)*
- **teams**, **clients**, **projects**: array of ids *(optional)*
- **managerUid**: string *(optional)*

### Subcollections
- **tasks**: see [Task fields](#tasks-subcollection)
- **sessions**: { userAgent, startAt, endAt, active }
- **loginHistory**: { timestamp, userAgent }

## settings (collection)
- **taskTypes** document: { types: array of strings }
- other documents contain arbitrary settings objects

## auditLogs (collection)
- **adminUid**: string
- **action**: string
- **targetUid**: string *(optional)*
- **extra**: object *(optional)*
- **timestamp**: timestamp

## departments (collection)
- **name**: string
- **createdAt**: timestamp

### Subcollection: members
- **assignedAt**: timestamp

## teams (collection)
- **name**: string
- **createdAt**: timestamp

### Subcollection: members
- **assignedAt**: timestamp

## clients (collection)
- **name**: string
- **createdAt**: timestamp

## projects (collection)
- **name**: string
- **teamId**: string *(optional)*
- **clientId**: string *(optional)*
- **createdAt**: timestamp

### Subcollections
- **members**: { assignedAt }
- **timeEntries**: { userId, minutes, description, createdAt }

## invoices (collection)
- **clientId**: string
- **month**: string (e.g. `2024-02`)
- **totalMinutes**: number
- **createdAt**: timestamp

## apiKeys (collection)
- **key**: string
- **createdBy**: uid
- **createdAt**: timestamp

## rateLimits (collection)
- document id format: `<uid>_<action>`
- **startAt**: timestamp
- **count**: number

## userRequests (collection)
Used for admin notifications.
- **message**: string *(optional)*
- other arbitrary fields

## roles (collection)
- Document id: role identifier (e.g. `admin`)
- **description**: string *(optional)*
- **permissions**: array of strings *(optional)*
Stores all available roles in the system. `permissions` holds identifiers used
by the UI and middleware to restrict access to certain actions.

Example:

```json
{
  "description": "Full administrator",
  "permissions": ["manageUsers", "manageProjects"]
}
```

## userRoles (collection)
Mapping between users and roles.
- **userId**: string
- **roleId**: string (matches role document id)
- **assignedAt**: timestamp
Links a user to one or more roles. A user may have multiple documents in this
collection, one for each assigned role.

## invites (collection)
Pending invitations waiting for sign up.
- **email**: string
- **roleId**: string
- **projectId**: string *(optional)*
- **token**: string
- **status**: `sent` | `accepted` | `expired`
- **createdAt**: timestamp
- **acceptedAt**: timestamp *(optional)*
- **acceptedBy**: string *(optional)*

## tasks (collection)
Top-level storage for tasks. Each document mirrors the fields listed in the
[Tasks subcollection](#tasks-subcollection) and may be referenced from other
collections.

## taskComments (collection)
Stores threaded comments for tasks.
- **taskId**: string
- **authorId**: string
- **text**: string
- **createdAt**: timestamp
- **updatedAt**: timestamp *(optional)*
- **internal**: boolean *(optional)*
- **reactions**: map *(optional)*

## taskActivity (collection)
Historical activity records for tasks.
- **taskId**: string
- **action**: string
- **actorId**: string *(optional)*
- **timestamp**: timestamp
- **extra**: object *(optional)*

## taskAttachments (collection)
Metadata for files attached to tasks.
- **taskId**: string
- **name**: string
- **size**: number
- **contentType**: string
- **url**: string
- **uploadedBy**: uid
- **createdAt**: timestamp

## timeLogs (collection)
Time tracking entries.
- **taskId**: string
- **userId**: string
- **minutes**: number
- **description**: string *(optional)*
- **billable**: boolean *(optional)*
- **createdAt**: timestamp

## taskRelations (collection)
Defines dependencies and relationships between tasks.
- **taskId**: string
- **relatedTaskId**: string
- **type**: `blocks` | `blockedBy` | `relatesTo` | `subtask`
- **createdAt**: timestamp

## notifications (collection)
User notifications and watch records.
- **taskId**: string *(optional)*
- **recipientId**: string
- **type**: string
- **read**: boolean
- **createdAt**: timestamp

## Tasks subcollection
Each user document has a `tasks` subcollection.
Fields are normalised in code and may include:
- **id**: string
- **title**: string
- **description**: string *(optional)*
- **notes**: string *(optional)*
- **priority**: `low` | `medium` | `high` | `critical`
- **status**: `todo` | `inprogress` | `review` | `done` | `blocked` | `cancelled`
- **dueDate**: ISO string *(optional)*
- **category**: string
- **type**: string
- **assignedTo**: uid *(optional)*
- **dependencies**: array of ids *(optional)*
- **estimate**: number *(optional)*
- **timeSpent**: number *(optional)*
- **attachments**: array *(optional)*
- **comments**: array *(optional)* – each item `{ text, author, userId, timestamp, reactions }`
- **tags**: array *(optional)*
- **labels**: array *(optional)*
- **subtasks**: array *(optional)*
- **activity**: array of { action, timestamp }
- **createdAt**: ISO timestamp
- **updatedAt**: ISO timestamp
- **reminderSent**: boolean *(optional)*
