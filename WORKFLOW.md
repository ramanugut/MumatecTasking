# Task Workflow

This document outlines the lifecycle of tasks within the application.

## Primary Status Categories
- **Backlog/To Do** – Newly created tasks awaiting assignment
- **In Progress** – Tasks currently being worked on
- **Under Review** – Work completed but awaiting approval/verification
- **Done/Completed** – Successfully finished tasks
- **Blocked/On Hold** – Temporarily paused due to dependencies or issues
- **Cancelled** – Tasks that will not be completed

## Priority Categories
- **Critical** – Security issues or outages
- **High** – Important user requests and compliance matters
- **Medium** – Standard operational items
- **Low** – Nice-to-have improvements

## Type Categories
- **User Account Management** – Creation, modification, deletion
- **Access Control** – Permission or role updates
- **Security** – Resets, lockouts, suspicious activity
- **Compliance** – Audit or policy tasks
- **Maintenance** – System updates, cleanup, or optimization

## Workflow Overview
1. **Task Creation** – New tasks start in *Backlog/To Do* with metadata such as priority and type recorded.
2. **Assignment & Planning** – Tasks remain in backlog until assigned and scheduled.
3. **Work Initiation** – Assigned users move tasks to *In Progress* and begin work.
4. **Completion** – Once finished, tasks transition to *Under Review* for verification.
5. **Review** – Approved tasks move to *Done/Completed*; rejected tasks return to *In Progress*.
6. **Closure** – Completed tasks are archived according to retention policies.

Blocked tasks can be moved to *Blocked/On Hold* from any active state. Cancelled tasks are removed from the standard flow.

The system keeps timestamped history for each status change to maintain a clear audit trail.
