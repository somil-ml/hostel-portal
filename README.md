# GGSIPU EDC Hostel Allocation System (

## Overview:
Hostel allocation at GGSIPU involves managing hundreds of students from different programs with varying requirements - distance from hometown, medical conditions, room preferences, and special accommodation needs. 

Currently, this process is managed manually through spreadsheets and physical verification, which can be time-consuming for both students and administrative staff.

## What We Built
A web-based hostel allocation system that automates the entire process using Google Workspace tools (completely free, no servers needed).

**Main Features:**
- Students apply through Google Form
- System automatically calculates a priority score based on:
  - Distance from hometown (farther = higher priority)
  - Medical conditions (wheelchair, asthma, etc.)
  - Special accommodation needs
- Live dashboard showing how many rooms are left
- Students can check their status online by entering their roll number
- One-click allocation that assigns rooms based on priority
- Automatic email notifications when rooms are allotted

## Tech Stack
- **Backend:** Google Apps Script + Google Sheets (as database)
- **Frontend:** HTML, CSS, JavaScript
- **Hosting:** Vercel (free tier)
- **Forms:** Google Forms for applications
- **Email:** Gmail API for notifications

## How It Works

**For Students:**
1. Fill the Google Form with your details (distance, medical needs, etc.)
2. Get added to the waitlist automatically
3. Check your status on the web portal anytime
4. Get an email when rooms are allocated

**For Admin (Chief Warden):**
1. All applications come into Google Sheets
2. Click one button to run the allocation algorithm
3. System sorts students by priority score and assigns rooms
4. Emails go out automatically to all students
5. Dashboard updates in real-time

## The Algorithm
We use a simple priority scoring system:
- **Distance:** 
  - >1000 km = 50 points
  - 500-1000 km = 30 points
  - 200-500 km = 15 points
- **Medical Needs:**
  - Wheelchair access = 200 points
  - Chronic medical condition = 150 points
  - Asthma/Allergy = 100 points

Students with highest scores get rooms first. This ensures fairness instead of just "who applied first."

## Live Demo
Check it out: https://hostel-portal-eight.vercel.app

Try these test roll numbers:
- 131262024001 (High priority - medical + far distance)
- 131262024014 (Low priority - lives nearby)

## What We Could Add Next
If we had more time, we'd add:
- Roommate preference matching
- Grievance/complaint system
- Transfer requests between hostels
- Better admin dashboard with charts
- Category-based quotas (SC/ST/OBC)

## Built By
- Somil
- Anugya
- Nikita
- Manas
- Nemish
- Shashank
**Team ID : SIH2026-T072**  

**For:** Smart India Hackathon (SIH) - 2026
