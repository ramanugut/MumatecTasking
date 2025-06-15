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
- **phone**: string *(optional)*
- **timezone**: string *(optional)*
- **skills**: array of strings *(optional)*
- **status**: string *(optional)*
- **notifications**: { email: boolean, push: boolean } *(optional)*
- **onboarded**: boolean *(optional)*
- **disabled**: boolean *(optional)*
- **guestExpiresAt**: timestamp *(optional)*
- **lastLogin**: timestamp *(optional)*
- **teams**, **clients**, **projects**: array of ids *(optional)*
- **managerUid**: string *(optional)*

### Subcollections
- **tasks**: see [Task fields](#tasks-subcollection)
- **sessions**: { userAgent, startAt, endAt, active }

## settings (collection)
- **taskTypes** document: { types: array of strings }
- other documents contain arbitrary settings objects

## auditLogs (collection)
- **adminUid**: string
- **action**: string
- **targetUid**: string *(optional)*
- **extra**: object *(optional)*
- **timestamp**: timestamp

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
- **comments**: array *(optional)*
- **tags**: array *(optional)*
- **labels**: array *(optional)*
- **subtasks**: array *(optional)*
- **activity**: array of { action, timestamp }
- **createdAt**: ISO timestamp
- **updatedAt**: ISO timestamp
- **reminderSent**: boolean *(optional)*
