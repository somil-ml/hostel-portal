# 🏠 Hostel Allocation & Management System

A web-based hostel allocation and management system designed to streamline student applications, priority-based room allocation, status tracking, and email notifications.

The system combines a **Vercel-hosted student portal** with a **Google Apps Script backend and Google Sheets database**, providing a lightweight and practical solution for managing hostel applications.

## ✨ Features

### 👨‍🎓 Student Portal

* Check hostel application status using roll/registration number
* View allocation status
* View allocated room number when applicable
* View application information and submission details
* Responsive web interface

### 🏢 Hostel Allocation

* Automated eligibility checking
* Priority-based allocation system
* Supports:

  * Single-seated rooms
  * Triple-seated rooms
  * Four-seated rooms
* Separate room inventories for male and female hostels
* Preferred room type handling
* Preferred roommate requests
* Automatic fallback to other available room types
* Waitlisting when no suitable room is available

### 📊 Priority Scoring

Applications can be prioritized using multiple factors:

* Distance from residence
* Special accommodation/medical requirements
* Reservation category

The scoring system is configurable from a central configuration section in the backend.

### 📧 Email Notifications

Students can receive automatic email notifications when their application status changes:

* **Allotted** — includes the allocated room number
* **Waitlisted** — informs the student of their current status
* **Not Eligible** — provides the eligibility reason

The system prioritizes the student's **personal email address** and can fall back to the university email address when a personal email is unavailable.

### 🔐 Admin Dashboard

The administrative dashboard provides:

* Secure admin login
* View all applications
* Filter applications by status and gender
* Manually update application status
* Assign or modify room numbers
* Run the allocation algorithm
* Send pending notifications
* View recent audit logs

All administrative operations are protected by an admin password stored in Google Apps Script Script Properties rather than in the frontend.

### 📝 Audit Logging

Administrative actions and allocation runs are recorded in an audit log, providing a basic history of system activity.

---

## 🏗️ Architecture

```text
                    ┌──────────────────────┐
                    │      Students        │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │   Vercel Web Portal  │
                    │      Frontend        │
                    └──────────┬───────────┘
                               │
                         API Requests
                               │
                               ▼
                 ┌──────────────────────────┐
                 │    Google Apps Script    │
                 │         Backend          │
                 │                          │
                 │ • Status Lookup          │
                 │ • Room Availability      │
                 │ • Allocation Algorithm    │
                 │ • Email Notifications    │
                 │ • Admin Functions         │
                 │ • Audit Logging           │
                 └────────────┬─────────────┘
                              │
                              ▼
                 ┌──────────────────────────┐
                 │      Google Sheets       │
                 │    Application Data      │
                 └──────────────────────────┘
```

### Technology Stack

| Component        | Technology                           |
| ---------------- | ------------------------------------ |
| Frontend         | HTML, CSS, JavaScript                |
| Frontend Hosting | Vercel                               |
| Backend          | Google Apps Script                   |
| Database         | Google Sheets                        |
| Email            | Google Apps Script MailApp           |
| Authentication   | Admin password via Script Properties |
| API              | Google Apps Script Web App           |

---

## 🔄 Application Flow

### 1. Student Application

Students submit their hostel application through the designated application form.

Application data is stored in Google Sheets.

### 2. Eligibility Check

The backend evaluates the application.

Students residing within the defined day-scholar distance are marked **Not Eligible**, unless they have a qualifying special accommodation requirement.

### 3. Priority Calculation

Eligible students receive a priority score based on configured criteria such as:

* Distance
* Special accommodation requirements
* Reservation category

### 4. Room Allocation

Applications are processed according to priority.

The system attempts to:

1. Accommodate requested roommates where possible.
2. Assign the preferred room type.
3. Fall back to other available room types if necessary.
4. Place students on the waitlist when no suitable room is available.

### 5. Notification

After allocation, students can be notified of their current status by email.

### 6. Status Tracking

Students can enter their roll/registration number on the public portal to check their current application status.

---

## 📁 Repository Structure

```text
hostel-portal/
│
├── index.html
│
├── apps-script/
│   ├── Code.gs
│   └── AdminDashboard.html
│
└── README.md
```

The `apps-script/Code.gs` file contains the source code for the deployed Google Apps Script backend. The live backend remains deployed through Google Apps Script, while GitHub acts as the project's source-code repository.

## 🧠 Technical Deep Dive

### Request Flow

The system is split into three practical layers:

```text
Student Browser
      │
      │ HTTPS request
      ▼
Vercel Frontend
      │
      │ fetch()/API request
      ▼
Google Apps Script Web App
      │
      ├── Reads/writes Google Sheets
      ├── Runs allocation logic
      ├── Authenticates admin requests
      └── Sends email through MailApp
```

The frontend is responsible for presentation and collecting user input. The backend is the trusted layer that performs allocation, validates administrative actions, accesses the spreadsheet, and sends emails. Google Sheets acts as the persistent data store.

### Main Backend Responsibilities

The Apps Script backend is divided conceptually into these blocks:

1. **Configuration** — central constants for spreadsheet columns, hostel capacity, scoring rules, and email behavior.
2. **Spreadsheet helpers** — locate the response sheet, identify columns by header name, create/read supporting sheets, and normalize values.
3. **Eligibility** — decide whether an applicant is eligible before scoring or placement.
4. **Scoring** — calculate a priority score from the configured criteria.
5. **Room inventory** — build available room pools for male and female hostels and track room capacity/occupants.
6. **Allocation** — process eligible candidates, handle roommate preferences, preferred room types, fallbacks, and waitlisting.
7. **Admin API** — authenticated functions used by the dashboard for viewing, editing, allocation, inventory management, and publication.
8. **Notifications** — resolve the student's preferred email address and send status-specific messages.
9. **Audit logging** — record administrative actions and allocation activity.

### Allocation Decision Order

For an applicant who needs allocation, the important logical order is:

```text
Application
   ↓
Eligibility check
   ↓
Priority score
   ↓
Existing valid manual/allotted room?
   ├── Yes → preserve it
   └── No
        ↓
Roommate preference
        ↓
Preferred room type
        ↓
Compatible fallback room type
        ↓
Room available?
   ├── Yes → assign room
   └── No → Waitlisted
```

An applicant who fails the configured eligibility rule is marked **Not Eligible** and does not enter normal room allocation. A valid existing room allocation is preserved so that rerunning the algorithm does not unexpectedly move an already-assigned student.

### Capacity vs. Room Identity

The official hostel figures represent total infrastructure. The administrator separately controls the number of rooms currently available for an allocation cycle. The system can generate neutral allocation identifiers such as `B-001` and `G-001`; these should be treated as system allocation IDs rather than claims about official physical room numbers unless the university provides an actual room-number list.

### Admin Authentication

The admin password is stored in Apps Script Script Properties. The dashboard sends the entered password to server-side admin functions; the backend validates it before returning protected application data or performing administrative operations. The password is not embedded as a frontend credential.

### Manual Overrides

The dashboard can manually change a student's status and room. An `Allotted` status requires a valid room ID, preventing an invalid `Allotted + N/A` state. A valid existing room is recognized by the allocator and preserved on subsequent allocation runs. This is useful for legitimate administrative exceptions.

### Results Publication Model

Allocation and publication are separate concepts:

```text
Calculate Allocation
        ↓
Results stored for admin review
        ↓
Results remain hidden
        ↓
Admin publishes
        ↓
Student portal exposes result
        ↓
Notifications can be sent
```

This prevents students from seeing provisional results while administrators are still reviewing the allocation.

### Why Google Sheets?

For a university prototype, Google Sheets provides a low-cost, familiar operational database. Administrators can inspect the underlying records while Apps Script provides server-side automation. The trade-off is that Sheets is not a conventional relational database, so the backend must carefully identify columns, validate inputs, and control concurrent administrative changes.

## 🏆 Hackathon Technical Talking Points

If asked **“Why this architecture?”**, explain that the team wanted a lightweight system that could be deployed quickly without maintaining a separate database server. Vercel provides the public frontend, Apps Script provides server-side automation and Google ecosystem integration, and Sheets provides persistent tabular data that hostel administrators can already understand.

If asked **“What is the algorithm?”**, explain that it is a constraint-based, priority-driven allocation process rather than simply assigning rooms randomly. Eligibility is checked first; eligible applicants are scored; the system then attempts roommate/preference matching, preferred room types, fallback rooms, and finally waitlisting.

If asked **“What happens when rooms run out?”**, explain that the available inventory is finite. Once no compatible room with sufficient capacity remains, the applicant is waitlisted rather than being assigned a nonexistent room.

If asked **“Can an admin override the algorithm?”**, explain that yes: the admin dashboard can make a manual allocation, and the backend requires an allotted student to have a room ID. Valid existing allocations are preserved on later allocation runs.

If asked **“How do you prevent premature result disclosure?”**, explain the separate calculation/publication state. The backend can calculate and store results while the public portal continues to show that results have not been published.

If asked **“How are emails protected from accidental duplicates?”**, explain that the backend maintains notification state so the same student/status combination is not repeatedly notified unnecessarily.

If asked **“What are the limitations?”**, be honest: the prototype relies on Google Sheets rather than a transactional database, the actual university room-number mapping is not currently supplied by the available hostel information, and institutional eligibility rules such as day-scholar/reservation-category exceptions must be confirmed with the university before production use.

---

## 🚀 Deployment

### Frontend

The frontend is deployed through Vercel and connected to this GitHub repository.

Any updated frontend code can be deployed through the normal Vercel/GitHub deployment workflow.

### Backend

The backend source is maintained in `apps-script/Code.gs` and is deployed as a Google Apps Script Web App.

The Apps Script backend handles:

* Student status lookup
* Room availability
* Hostel allocation
* Administrative operations
* Email notifications
* Audit logging

---

## 🔒 Security Considerations

* Administrative authentication is handled server-side.
* The admin password is stored using **Google Apps Script Script Properties** rather than hardcoded in the frontend.
* Sensitive backend configuration is kept separate from the public frontend repository.
* Test email redirection should be disabled before production use.
* Production data and credentials should not be committed to the public GitHub repository.

---

## 📌 Current Status

The system currently supports:

* ✅ Student application data management
* ✅ Automated eligibility checking
* ✅ Priority-based hostel allocation
* ✅ Room assignment
* ✅ Waitlisting
* ✅ Student status lookup
* ✅ Admin dashboard
* ✅ Email notifications
* ✅ Personal email prioritization
* ✅ Audit logging
* ✅ Vercel deployment

---

## 🎯 Project Goal

The goal of the Hostel Allocation & Management System is to replace a fragmented, manual hostel allocation workflow with a centralized digital system that makes the process:

* **Faster**
* **More transparent**
* **Easier to administer**
* **Easier for students to track**
* **Less dependent on manual spreadsheet operations**

---

## 👥 Project

Developed as a student project focused on applying web development, automation, and data-driven allocation to a real-world university hostel management problem.
