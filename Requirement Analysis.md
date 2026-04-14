# Requirement Analysis

## Secure School Voting System

Date: April 13, 2026

## 1. Introduction

This document presents the requirement analysis for the Secure School Voting System. It defines what is needed for the system to operate effectively for administrators, voters, and the development team. The study focuses on the development of a secure and reliable school voting platform by integrating role-based dashboards, secure authentication, election workflows, backend services, and database-level access control.

## 2. Objective of Requirement Analysis

The objective is to identify the minimum and recommended requirements for:

- Administrative users managing election operations.
- End users (voters and judges) participating in voting activities.
- Developers and technical maintainers handling backend services and deployment.

By defining these requirements, the project ensures consistent performance, security, and usability during implementation and deployment.

## 3. User and System Requirement Categories

The requirements are grouped into three major categories:

- Hardware and software requirements for Admin users.
- Hardware and software requirements for Voters and other standard users.
- Development and backend service requirements for system maintenance and scaling.

## 4. Admin Requirements

### 4.1 Admin Hardware Requirements

Minimum:

- Processor: Intel Core i3 (8th gen) or AMD Ryzen 3 equivalent.
- Memory (RAM): 8 GB.
- Storage: 128 GB SSD free space.
- Display: 1366 x 768 resolution.
- Network: Stable internet connection at 10 Mbps.

Recommended:

- Processor: Intel Core i5 (10th gen or newer) or AMD Ryzen 5.
- Memory (RAM): 16 GB.
- Storage: 256 GB SSD or higher.
- Display: 1920 x 1080 resolution.
- Network: 25 Mbps or higher for smooth dashboard and report operations.

### 4.2 Admin Software Requirements

- Operating System: Windows 10/11, macOS 12+, or modern Linux distribution.
- Browser: Latest Google Chrome, Microsoft Edge, or Mozilla Firefox.
- PDF/Spreadsheet tools: Needed for report export and verification workflows.
- Optional security tools: Endpoint protection and MFA authenticator app for privileged access.

### 4.3 Admin Functional Requirements

The admin must be able to:

- Log in securely with role-based authorization.
- Create and manage election events and voting periods.
- Manage users, candidates/contestants, and assignments.
- Monitor vote progress and system notifications.
- Access audit-related records for accountability.

## 5. Voter and Standard User Requirements

### 5.1 Voter Hardware Requirements

Minimum (Laptop/Desktop):

- Processor: Dual-core 2.0 GHz.
- Memory (RAM): 4 GB.
- Storage: 64 GB available.
- Network: Stable internet connection at 5 Mbps.

Minimum (Mobile):

- Android 10+ or iOS 14+ device.
- 3 GB RAM or higher.
- Updated mobile browser.

Recommended:

- Laptop/Desktop with 8 GB RAM and SSD storage.
- Mobile device with 4 GB RAM or higher.
- Internet speed of 10 Mbps or higher for faster loading and fewer interruptions.

### 5.2 Voter Software Requirements

- Browser with JavaScript enabled and cookies allowed.
- Updated operating system and browser version for compatibility and security.
- Access to registered account credentials and verification method (if enabled).

### 5.3 Voter Functional Requirements

The voter must be able to:

- Access the system using valid credentials.
- View active election or pageant ballots assigned to their role.
- Submit votes once within allowed time windows.
- Receive confirmation and relevant notifications after submission.

## 6. Development and Backend Service Requirements

### 6.1 Development Environment Requirements

Minimum:

- Processor: Quad-core CPU.
- Memory (RAM): 16 GB.
- Storage: 20 GB free for source code, node modules, and build artifacts.

Recommended:

- Processor: 6 cores or higher.
- Memory (RAM): 32 GB.
- Storage: 50 GB SSD free space.

Software stack:

- Node.js LTS (frontend and backend toolchain).
- npm or compatible package manager.
- Git for version control.
- Code editor (VS Code recommended).
- Supabase project access and SQL migration tooling.

### 6.2 Backend Service Requirements

Backend services must provide:

- Authentication and authorization middleware.
- Role validation for protected endpoints.
- Election and vote business logic APIs.
- Notification handling services.
- Audit and logging support for critical actions.
- Error handling and request validation middleware.

### 6.3 Database and Security Requirements

- PostgreSQL/Supabase with row-level security policies enabled.
- Migration-based schema management for traceability.
- Atomic transaction logic for vote submission and challenge handling.
- Backup strategy and restore validation for reliability.
- Secrets management for API keys and service credentials.

### 6.4 Operational Requirements

- Environment separation: development, staging, and production.
- Monitoring for API errors, authentication failures, and latency.
- Incident response and rollback procedure documentation.
- Regular security review of policies and privileged operations.

## 7. Non-Functional Requirements

- Security: Confidentiality and integrity of votes and user accounts must be enforced.
- Performance: Core pages and voting actions should respond within acceptable time under expected load.
- Availability: System must be accessible during official voting windows.
- Usability: Interfaces should be clear and role-specific to minimize user errors.
- Maintainability: Modular code and versioned migrations must support long-term updates.

## 8. Summary

This requirement analysis defines the practical needs to operate and sustain the Secure School Voting System across users and technical teams. The study demonstrates that by integrating secure authentication, role-based access, backend service orchestration, and policy-driven database controls, the system can meet institutional voting requirements when deployed with the specified hardware, software, and operational standards.
