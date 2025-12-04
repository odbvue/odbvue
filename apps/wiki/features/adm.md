# Admin Module

## Overview

The Admin module provides comprehensive administrative functionality for managing the OdbVue system. It enables system administrators to monitor, audit, and control all aspects of the application including user management, access permissions, email delivery, job scheduling, system statistics, alerts, and configuration settings. The module enforces strict role-based access control (ADMIN role required) for all operations.

## User Stories

- **View Audit Logs**: Admins can review complete system audit trail with filtering by user, severity, module, and date range to track system activities
- **Manage Users**: Admins can view user list, check user status (unverified/verified/suspended), review last access times, and navigate to detailed user profiles
- **Manage Roles**: Admins can view all available roles and their descriptions for the system
- **Control Permissions**: Admins can view and manage user permissions with time-based validity (start/end timestamps), assign roles with specific permissions to users, and track permission activity
- **Track Emails**: Admins can monitor email delivery status and diagnose email issues, view sender information and delivery attempts
- **Control Jobs**: Admins can view scheduled jobs with schedules and execution status, review job execution history with status and output, enable/disable jobs, and manually trigger job runs
- **Monitor Statistics**: Admins can review application metrics (users, data, activity) aggregated by multiple time periods (hourly to yearly)
- **System Alerts**: Admins receive alerts about system conditions and issues with alert types and values
- **Configure Settings**: Admins can update application configuration parameters including secret values with proper masking

## Data Model

### Core Tables

- **app_users**: User account information
  - Columns: id, uuid, username, email, fullname, status (N=unverified, A=active, D=suspended), created, accessed, attempts
  - Primary role: User identity and authentication tracking

- **app_audit**: System audit trail for compliance and monitoring
  - Columns: id, severity (FATAL, ERROR, WARN, INFO, DEBUG), message, module, attributes (JSON), uuid (user ref), created
  - Primary role: Complete system activity logging

- **app_roles**: Role definitions for permission system
  - Columns: id, role (unique), description
  - Primary role: Define available roles in the system

- **app_permissions**: User-role-permission assignments with time-based validity
  - Columns: id, id_user (FK to app_users.id), id_role (FK to app_roles.id), permission (varchar2), valid_from (timestamp), valid_to (timestamp)
  - Primary role: Granular permission management with time-based activation/expiration
  - Composite Key: (id_user, id_role)

- **app_emails**: Email delivery records and status tracking
  - Columns: id, to_address, subject, content, status (PENDING, SENT, ERROR), created, delivered, attempts, error, message_id
  - Primary role: Email delivery monitoring and diagnostics

- **app_stats**: Application metrics by period
  - Columns: period_type (H, D, W, M, Q, Y, A), period_label, metric_name, metric_value
  - Period types: H (hourly), D (daily), W (weekly), M (monthly), Q (quarterly), Y (yearly), A (all-time)
  - Primary role: Time-series application metrics

- **app_alerts**: System alerts and notifications
  - Columns: alert_type, alert_text, alert_value, created
  - Primary role: Alert management and system health monitoring

- **app_settings**: Application configuration parameters
  - Columns: key, name, value, secret (boolean), options (JSON)
  - Primary role: Application configuration management

## API

All endpoints require ADMIN role. Access is validated at procedure entry point via `pck_api_auth.role(NULL, 'ADMIN')` returning HTTP 401 if unauthorized.

### Audit
- `GET /adm/audit/` - Get audit logs with filtering and pagination
  - Filters: uuid (array), username (array), severity (array), module (array), period_from (timestamp), period_to (timestamp)
  - Parameters: limit (default 10), offset (default 0)

### Users
- `GET /adm/users/` - Get user list with search and pagination
  - Parameters: search (username), limit (default 10), offset (default 0)
  - Response: username, fullname, created, accessed, status, status_text

### Roles
- `GET /adm/roles/` - Get list of available roles
  - Parameters: search, limit (default 10), offset (default 0)
  - Response: role, description

### Permissions
- `GET /adm/permissions/` - Get user permissions with filtering and pagination
  - Filters: uuid (array of user UUIDs)
  - Parameters: search, limit (default 10), offset (default 0)
  - Response: id, uuid, role, permission, active (Y/N based on valid_from/valid_to), from (timestamp), to (timestamp)

- `POST /adm/permission/` - Set user permission (assign permission to user with time validity)
  - Parameters: uuid (user), role, permission, from (start timestamp), to (end timestamp)
  - Response: validation errors if any

### Emails
- `GET /adm/emails/` - Get email logs with filtering and pagination
  - Filters: status (array), period_from (timestamp), period_to (timestamp)
  - Parameters: limit (default 10), offset (default 0)
  - Response: id, created, to_address, subject, status, message_id

### Jobs
- `GET /adm/jobs/` - Get scheduled jobs list with execution status
  - Parameters: search (job name), limit (default 10), offset (default 0)
  - Response: name, schedule, started, duration, comments, enabled

- `GET /adm/jobs-history/` - Get job execution history with filtering
  - Filters: name (array of job names)
  - Parameters: limit (default 10), offset (default 0)
  - Response: name, started, duration, status, output

- `POST /adm/job-enable/` - Enable a scheduled job
  - Parameters: name (job name)

- `POST /adm/job-disable/` - Disable a scheduled job
  - Parameters: name (job name)

- `POST /adm/job-run/` - Manually trigger job execution
  - Parameters: name (job name)

### Settings
- `GET /adm/settings/` - Get application settings
  - Parameters: search (setting name), limit (default 10), offset (default 0)
  - Response: key, name, value (masked if secret=true), secret, options

- `POST /adm/setting/` - Update application setting
  - Parameters: id (setting key), value (new value)
  - Response: validation errors if any

### Statistics & Alerts
- `GET /adm/stats/` - Get application statistics by period
  - Response: period_type, period_label, metric_name, metric_value

- `GET /adm/alerts/` - Get system alerts
  - Response: alert_type, alert_text, alert_value, created

## UI Views (Pages)

1. **Dashboard** (`/admin`) - Overview with charts and alert widgets
   - Displays metrics chart with selectable metric types and configurable time periods
   - Shows alert status cards with alert types and values
   - Provides quick navigation cards to all admin sections (audit, users, roles, permissions, emails, jobs, settings)
   - Responsive grid layout with primary metrics on left, alerts on right

2. **Users List** (`/admin/users`) - User management
   - Table view of all users with username, full name, created date, last accessed, status
   - Status formatting: Unverified (warning), Verified (success), Suspended (error)
   - Search by username
   - Navigate to user detail page via UUID

3. **User Details** (`/admin/users/[uuid]`) - User profile with tabs
   - **Details Tab**: User information (username, fullname, dates, status)
   - **Permissions Tab**: User's assigned permissions with role, permission name, active status, and valid date range
   - **Audit Tab**: User-specific audit log entries
   - **Emails Tab**: User-related email records

4. **Audit Logs** (`/admin/audit`) - System audit trail
   - Table of all audit entries with created date, severity, module, username, and message
   - Severity color coding: ERROR (red), WARN (orange), INFO (blue)
   - Filterable by severity, module, username, and date range
   - View JSON attributes for audit entries
   - Sortable by created timestamp

5. **Email Logs** (`/admin/emails`) - Email delivery monitoring
   - Table of email records with created date, recipient, subject, status, and message ID
   - Status indicators (PENDING, SENT, ERROR)
   - Filterable by status and date range
   - Display complete email content when needed

6. **Jobs** (`/admin/jobs`) - Job scheduler management
   - Table view of scheduled jobs showing name, schedule expression, last started, duration, comments, and enabled status
   - Action buttons to enable, disable, or manually run jobs
   - Success/error notifications for job actions
   - Navigate to job details page to view execution history

7. **Job History** (`/admin/jobs/[name]`) - Job execution history
   - Table of job execution records showing name, started timestamp, duration, status, and output
   - Display detailed execution output for each job run
   - Navigate back to jobs list

8. **Settings** (`/admin/settings`) - Application configuration
   - Table view of all settings with key, name, and value
   - Secret values are masked/hidden in display
   - Action buttons to edit settings
   - Real-time validation and error display on update
   - Support for options field (JSON) for settings with multiple choices

## Security

**Access Control**:
- All admin module endpoints and UI pages require ADMIN role
- Role validation performed at database procedure entry point via `pck_api_auth.role(NULL, 'ADMIN')`
- HTTP 401 returned if user lacks ADMIN role
- Prevents unauthorized access through both API and UI

**Page Meta Security**:
- All admin pages define meta configuration:
  - `access: 'with-role'` - Requires authentication with role
  - `visibility: 'with-role'` - Only visible to users with specified roles
  - `roles: ['admin']` - Explicitly requires admin role
- Router guards enforce these restrictions before page rendering

**Package Body Security**:
- Each procedure in `pck_adm.sql` validates ADMIN role at entry
- Non-admin access immediately returns HTTP 401 without processing request
- Prevents data leakage through query execution

**Data Protection**:
- Sensitive settings marked with `secret: true` are masked in UI display
- Permission time-based validity prevents unauthorized access windows
- Audit logging tracks all admin activities for compliance

## Jobs

1. **ADM_STATS_JOB** - Application statistics aggregation
   - Program: ADM_STATS_PROGRAM
   - Schedule: ADM_STATS_SCHEDULE
   - Function: Executes pck_adm.job_stats procedure
   - Purpose: Aggregates and refreshes application statistics across all time periods (hourly through yearly and all-time)
   - Auto-drop: TRUE (automatically drops after completion)
   - Logging: Off (logging_level = logging_off)
   - Priority: 3 (job_priority)

2. **ADN_ALERTS_JOB** - Alert status refresh
   - Program: ADN_ALERTS_PROGRAM
   - Schedule: ADN_ALERTS_SCHEDULE
   - Function: Executes pck_adm.job_alerts procedure
   - Purpose: Checks system conditions and refreshes alert records for admin monitoring
   - Auto-drop: TRUE (automatically drops after completion)
   - Logging: Off (logging_level = logging_off)
   - Priority: 3 (job_priority)
   - Populates app_stats table for dashboard visualization
   - Priority 3, logging disabled

2. **adm_alerts_job** - Checks for system conditions requiring alerts
   - Evaluates alert conditions and updates app_alerts
   - Triggered by scheduler
