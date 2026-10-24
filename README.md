# ExamVault — Secure Examination Document Lifecycle Management

**ExamVault** is a cybersecurity vault prototype designed to secure examination documents across their entire lifecycle — from upload, cryptographic fingerprinting, and policy enforcement to audit logging and real-time security threat detection.

---

## 🌟 Key Features

1. **Secure Document Vault**:
   - Central repository for confidential examination documents.
   - Metadata tracking: Sensitivity level (Critical, High, Medium), Subject, Owner, Version tracking, and File Size.

2. **Cryptographic Fingerprinting**:
   - Uses Node's native `crypto` module to generate SHA-256 hash digests for all documents.
   - Interactive **Verify Integrity** button to validate document hashes.
   - Hackathon **Simulate Tampering** feature to demonstrate real-time intrusion detection and payload corruption alerts.

3. **Context-Aware Access Verification Engine**:
   - Rule-based access decisions considering **User Role**, **Requested Action** (`VIEW`, `DOWNLOAD`, `EDIT`), **Declared Purpose**, and **Time Window**.
   - Immediate `ALLOWED` or `BLOCKED` decision output with clear rationale.

4. **Real-time Security Activity & Intrusion Monitoring**:
   - Visual threat monitoring dashboard tracking `CRITICAL`, `HIGH`, `MEDIUM`, and `LOW` severity security alerts.
   - Interactive "Mark as Reviewed" action to resolve security events.

5. **Immutable Audit Trail**:
   - Captures comprehensive **Who / When / What / Why** logs for every system action (Uploads, Access Requests, Denials, Verification Checks, Policy Changes, and Tampering Events).
   - Filter logs by `ALLOWED`, `BLOCKED`, or `WARNING`.

6. **Cybersecurity Dashboard UI**:
   - Built with a modern dark navy security aesthetic, glowing status indicators, statistics cards, responsive navigation, and user-switching capabilities for effortless demo presentations.

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite, JavaScript, CSS (Cybersecurity Dark Navy System), React Router v6, Lucide Icons.
- **Backend**: Node.js, Express.js, CommonJS, JWT (`jsonwebtoken`), Password Hashing (`bcryptjs`), Rate Limiting (`express-rate-limit`), CSRF Protection, Token Revocation, Node `crypto` module (SHA-256).
- **Database**: Persistent SQLite database via Node's native `node:sqlite` (`backend/data/examvault.db`) with automated schema migrations, idempotent seeding, and server-side token revocation.

---

## 🚀 Local Setup & Running Instructions

### 1. Backend Server (Port 5000 / Configurable)

```bash
cd backend
npm install
cp .env.example .env   # On Windows PowerShell: Copy-Item .env.example .env
npm start
```

Backend will start on: `http://localhost:5000` (or the port defined in `PORT` environment variable).

> **Note on Port Conflicts**: If port 5000 is occupied by another service on your machine, you can run `PORT=5001 npm start`. In `frontend/vite.config.js`, adjust the proxy target to match `http://localhost:5001`.

### 2. Frontend Web Application (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Frontend will start on: `http://localhost:5173`

---

## 🔐 Prototype Credentials & Demo Accounts (Development Only)

> **Security Notice**: The credentials below are intended for local development, academic evaluation, and testing only. In production environments, default secrets are rejected at startup and passwords must be securely configured.

| Name | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Admin** | Administrator | `admin@examvault.local` | `admin123` |
| **Dr. Priya Sharma** | Exam Coordinator | `priya.sharma@university.edu` | `admin123` |
| **Akash G** | Staff | `akash.g@university.edu` | `admin123` |
| **Prof. Rahul Kumar** | Course Instructor | `rahul.kumar@university.edu` | `admin123` |
| **Anitha Rao** | Exam Evaluator | `anitha.rao@university.edu` | `admin123` |

*(Note: The top header bar includes a 1-click **Persona Switcher Dropdown** enabled in development/demo mode to seamlessly switch roles during presentations. Every persona switch generates an audit log event and issues a server-signed JWT).*


---

## 🎯 Important Hackathon Demo Scenarios

1. **Scenario 1 (Blocked Access)**:
   - Switch user to **Akash G (Staff)**.
   - Request `VIEW` access for `Computer Networks - Internal.pdf`.
   - **Result**: `✕ ACCESS BLOCKED` (Role 'Staff' unauthorized). Generates Audit Entry & Security Event `SEC-001`.

2. **Scenario 2 (Allowed Access)**:
   - Switch user to **Dr. Priya Sharma (Exam Coordinator)**.
   - Request `VIEW` access for `Data Structures - End Semester.pdf`.
   - **Result**: `✓ ACCESS GRANTED` (Policy satisfied). Generates Audit Entry.

3. **Scenario 3 (Integrity Verification & Tamper Simulation)**:
   - Navigate to Document Details (`/documents/DOC-001`).
   - Click **Verify Integrity** -> `✓ Integrity Verified`.
   - Click **Simulate Tampering** -> Content corrupted! Shows `⚠ INTEGRITY WARNING` banner, flags document as compromised, and creates a critical alert on Security Activity page (`/security`).
   - Click **Restore Document** -> Reverts payload back to original verified state.

---

## 🛡️ Production Security Architecture & Deployment Setup

### 1. Production JWT Secret Enforcement
In production (`NODE_ENV=production`), ExamVault enforces strict cryptographic key policies:
- Startup immediately terminates (`process.exit(1)`) if `JWT_SECRET` is missing, empty, shorter than 32 characters, or matches any known development placeholder.
- Development secret fallbacks are strictly prohibited outside explicit development/test environments.
- Secret values are never exposed or printed in application logs.

### 2. Account-Level Brute-Force & Cooldown Protection
To defend against distributed credential-stuffing attacks across rotating IP addresses:
- Failed login attempts targeting any account (normalized by email) are tracked persistently in SQLite (`account_login_attempts`).
- Reaching the failure threshold (default: 5 attempts within 15 minutes) puts the target account into a temporary cooldown (default: 60 seconds).
- Identical safe HTTP 401 and HTTP 429 error messages are returned for both registered and unregistered email addresses, preventing account enumeration.
- Legitimate logins automatically clear failure tracking state upon successful authentication.

### 3. Server-Side Session Invalidation
- **Individual Session Revocation**: Logging out revokes the specific session token's `jti` in the SQLite `revoked_tokens` table.
- **Account-Wide Session Invalidation**: In case of credential reset or account compromise, calling `POST /api/auth/revoke-all-sessions` increments the user's `tokenVersion` in SQLite, immediately invalidating all active sessions for that account across all devices while preserving other users' active sessions.

### 4. Trusted Reverse-Proxy Deployment Setup
ExamVault extracts client IP addresses strictly through Express's trusted-proxy resolution (`req.ip`) and never trusts arbitrary raw `X-Forwarded-For` headers from incoming HTTP requests.

When deploying behind a reverse proxy (e.g., Nginx, AWS ALB, Cloudflare, Traefik):
- Configure the `TRUST_PROXY` environment variable to match your reverse-proxy topology:
  - `TRUST_PROXY=1`: Trust the immediate first reverse-proxy hop (default, suitable for single-layer Nginx or Vite dev proxy).
  - `TRUST_PROXY=loopback,linklocal,uniquelocal`: Trust private network subnets.
  - `TRUST_PROXY=192.168.1.10`: Trust a specific upstream proxy IP address.
  - `TRUST_PROXY=false`: Direct public deployment without reverse proxy (disables `X-Forwarded-For` parsing).
- Ensure your upstream reverse proxy strips or overwrites any client-supplied `X-Forwarded-For` header before forwarding requests to the ExamVault Node.js backend.

### 5. Secure Document Lifecycle & Persistent Storage (Phase 3)
ExamVault implements an enterprise-grade document lifecycle for confidential examination papers:
- **Multipart Binary Uploads**: Authenticated uploads via `multer` memory storage buffer files in memory to perform deep inspection before writing anything to disk.
- **Configurable Maximum Upload Size**:
  - `MAX_UPLOAD_SIZE_BYTES`: Defaults to `10485760` (10 MB). Configurable via environment variable `MAX_UPLOAD_SIZE_BYTES` or `MAX_UPLOAD_SIZE_MB`.
- **Allowed Document Formats & Deep Content Inspection**:
  - Allowed extensions: `.pdf`, `.docx`, `.xlsx`, `.txt`, `.png`, `.jpg`, `.jpeg`.
  - Allowed MIME types: `application/pdf`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`, `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `text/plain`, `image/png`, `image/jpeg`.
  - **Magic Byte Signature Verification**: The backend inspects binary headers to reject file extension spoofing (e.g., an executable renamed as `.pdf`).
- **Server-Controlled Storage Identifiers**:
  - Files are saved with server-generated UUID keys (`doc_<uuid><ext>`) under `backend/data/storage/` (excluded from git via `.gitignore`).
  - Client-supplied filenames and path traversal attempts are neutralized; original sanitized filenames are preserved in metadata only.
- **Database Metadata & Schema Migration v6**:
  - SQLite persists document metadata, fingerprints, and policy associations, with columns `storageKey`, `mimeType`, and `originalFileName`.
  - Binary blobs remain outside SQLite on persistent storage, ensuring lightweight queries and rapid backup capability.
- **Secure Downloads (`GET /api/documents/:id/download`)**:
  - Enforces role-based permissions (`Administrator`, `Exam Coordinator`, `Course Instructor`, `Exam Evaluator`) and document access policies.
  - Prohibits download of compromised/tampered documents for regular staff, while permitting download with warnings for Administrators and Exam Coordinators for forensic investigation.
  - Streams binary files with `Content-Disposition: attachment; filename="<sanitized_original_filename>"`, `X-Content-Type-Options: nosniff`, and records `DOCUMENT_DOWNLOAD` in audit logs.
- **Backward Compatibility**:
  - Seeded legacy documents without external storage keys dynamically synthesize UTF-8 byte streams on download, ensuring all original test scenarios and hackathon demonstrations remain operational.

### 6. Advanced Security Monitoring & Incident Response (Phase 4)
ExamVault features a deterministic heuristic threat detection engine and persistent incident response workflow:
- **Security-Event Model Normalization (Schema Migration v7)**:
  - Security events are normalized with `actorId`, `actorRole`, `resourceType`, `resourceId`, `resourceName`, `correlationId`, `outcome`, `ruleId`, `explanation`, and `incidentId`.
  - Backwards-compatible deserialization handles older pre-Phase-4 events gracefully with safe defaults.
- **Deterministic Threat Detection Rules**:
  - **Rule A (`RULE-AUTH-FAILED`)**: Detects repeated failed logins within a configurable window (default: 3 failures in 15 minutes). Correlates IP and account, debounces burst alerts, and automatically opens/updates incidents.
  - **Rule B (`RULE-DOC-UNAUTHORIZED`)**: Detects repeated access denials targeting confidential examination documents (default: 3 blocked attempts in 10 minutes) across single or multiple documents.
  - **Rule C (`RULE-SUSPICIOUS-PATTERN`)**: Detects anomalous bursts (> 8 requests in 30 seconds) or rapid privilege probing sequences (failed attempts followed by successful access within 5 minutes).
  - **Rule D (`RULE-INTEGRITY-TAMPER`)**: Creates critical security alerts and incidents upon cryptographic SHA-256 fingerprint mismatch or payload modification.
  - **Rule E (`RULE-ADMIN-CHANGE`)**: Monitors sensitive administrative operations, including policy updates, session revocations, and document restorations.
- **Persistent Incident Management Workflow**:
  - Automatically links security events into correlated incidents (`incidents` table) to prevent alert fatigue.
  - Full investigative workflow: `Open` -> `Investigating` -> `Resolved` / `False Positive`.
  - Immutable timeline notes (`incident_notes` table) record investigator findings, assignment changes, and resolution summaries.
  - Least-privilege access control: Restricted to `Administrator` and `Exam Coordinator` roles; unauthorized roles receive HTTP 403.
- **Security Monitoring Dashboard**:
  - **Security Overview**: Live metrics across selectable time windows (1h, 24h, 7d, 30d, all), severity breakdown, and real-time event feed.
  - **Event Explorer**: Filterable by severity, outcome, detection rule, and keyword search with pagination. Redacts sensitive forensic fields for ordinary users.
  - **Incident Center**: Comprehensive incident triage, drawer inspection, investigator assignment, and note logging.
  - **Detection Rules View**: Live status, trigger counts, and threshold configurations.
  - **Controlled Threat Simulation**: Admin-only sandbox to test real-time brute force, document harvest, and integrity alerts.


