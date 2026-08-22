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
├── index.html      # Student-facing web portal
└── README.md       # Project documentation
```

The Google Apps Script backend is maintained separately from this frontend repository.

---

## 🚀 Deployment

### Frontend

The frontend is deployed through Vercel and connected to this GitHub repository.

Any updated frontend code can be deployed through the normal Vercel/GitHub deployment workflow.

### Backend

The backend is deployed as a Google Apps Script Web App.

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
