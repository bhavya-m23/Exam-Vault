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
- **Backend**: Node.js, Express.js, JavaScript, Node `crypto` module (SHA-256).
- **Database**: Simple in-memory JavaScript data structures (`documents`, `users`, `auditLogs`, `accessPolicies`, `securityEvents`). No external databases required.

---

## 🚀 Local Setup & Running Instructions

### 1. Backend Server (Port 5000)

```bash
cd backend
npm install
npm start
```

Backend will start on: `http://localhost:5000`

### 2. Frontend Web Application (Port 5173)

```bash
cd frontend
npm install
npm run dev
```

Frontend will start on: `http://localhost:5173`

---

## 🔐 Prototype Credentials & Demo Accounts

Use any of the following accounts to test role-based permissions:

| Name | Role | Email | Password |
| :--- | :--- | :--- | :--- |
| **System Admin** | Administrator | `admin@examvault.local` | `admin123` |
| **Dr. Priya Sharma** | Exam Coordinator | `priya.sharma@university.edu` | `admin123` |
| **Akash G** | Staff | `akash.g@university.edu` | `admin123` |
| **Prof. Rahul Kumar** | Course Instructor | `rahul.kumar@university.edu` | `admin123` |

*(Note: The top header bar includes a 1-click **User Switcher Dropdown** to seamlessly switch demo roles during presentation).*

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
