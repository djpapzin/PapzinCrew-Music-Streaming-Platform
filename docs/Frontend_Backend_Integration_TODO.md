# Frontend-Backend Integration TODO List

This document outlines the step-by-step plan for integrating the frontend (starting with the `upload_page` directory) with the backend, focusing first on the upload endpoint. Update and check off items as progress is made.

---

## Phase 1: Initial Integration (Upload Endpoint)

- [x] **Review Backend Upload Endpoint**
  - Confirm the API route, request method, and expected payload (form-data, JSON, etc.)
  - Document required and optional fields
  - Test endpoint with a tool like Postman or curl

- [x] **Review Frontend Upload Page (upload_page)**
  - Identify the component responsible for file upload
  - Review current upload logic and UI
  - Note any assumptions or mismatches with backend expectations

- [x] **Connect Frontend to Backend**
  - Update frontend API URL to point to backend upload endpoint
  - Ensure correct request format (headers, form fields, etc.)
  - Handle responses and errors appropriately

- [x] **Test End-to-End Upload**
  - Upload a file from the frontend and verify it appears in backend storage/database
  - Check for error handling and user feedback

- [x] **Document Integration Details**
  - Note any changes made to frontend or backend
  - List any issues or edge cases discovered

---

## Phase 2: Advanced Features & Polish

- [x] **Metadata Extraction**
  - Ensure frontend extracts and sends all required metadata (title, artist, cover art, etc.)
  - Fallback to filename parsing if metadata is missing, with user alert
  - Backend validates and stores metadata

- [x] **Progress Bar & UI Feedback**
  - Implement upload progress indicator
  - Show success/error messages (basic alerts implemented, polish pending)

- [x] **Cover Art Handling**
  - Support cover art upload and association with tracks
  - Extract cover art from file if not provided

- [x] **Advanced Form Fields**
  - Add and support advanced/collapsible fields:
    - Tracklist (textarea)
    - Tags (text input)
    - Tag Artists (text input)
    - Genre, Availability, Explicit
    - (Removed: Language)

- [x] **Security & Validation**
  - Add file type/size validation on both frontend and backend (basic implemented, review for completeness)
  - Handle authentication/authorization if needed

- [ ] **Code Cleanup & Documentation**
  - Refactor code for clarity and maintainability
  - Update this TODO list and add inline code comments as needed

---

## Notes
- After Phase 1, share the AI code agent's code for review and integration.
- Use this document to track progress and assign tasks. 