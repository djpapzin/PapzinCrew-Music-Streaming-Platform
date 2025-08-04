# Papzin & Crew - Music Streaming Platform

## About The Project

Papzin & Crew is a platform designed to connect DJs and music enthusiasts. It provides a space for DJs to showcase their skills and for fans to discover a wide variety of new music and custom-made mixtapes. This project is the official implementation of the vision outlined in the [Papzin & Crew Business Plan](docs/Papzin_Crew_Business_Plan.md).

Our goal is to support and promote Mega-Mixers, provide a way for music lovers to discover new music, and eventually monetize the content for the Record Owners.

## MVP Scope

This repository contains the code for the Minimum Viable Product (MVP). The primary goal is to deliver the core music streaming experience.

The MVP will include:
*   The ability to see a list of available mixes.
*   The ability to stream any mix directly in the browser.
*   A simple interface for uploading new mixes.

For a detailed breakdown of the MVP, please see the [MVP Development Plan](docs/MVP_Development_Plan.md).

## Technology Stack

### Backend

*   **Framework**: **FastAPI** on Python.
*   **Server**: **Uvicorn** (for development).
*   **Database**: **SQLite** (for development) & **PostgreSQL** (for production) with **SQLAlchemy** (ORM) and **Alembic** (Migrations).
*   **Audio Storage**: Local filesystem for the MVP.

### Frontend

*   **Framework**: **Next.js** (React)
*   **Language**: **TypeScript**
*   **Styling**: **Tailwind CSS**
*   **Package Manager**: **npm**

## Getting Started

To get a local copy up and running, follow these simple steps.

### Prerequisites

*   Node.js (v18 or later recommended)
*   Python (v3.8 or later recommended)

### Installation & Setup

1.  **Clone the repository:**
    ```sh
    git clone https://github.com/djpapzin/PapzinCrew.git
    cd PapzinCrew
    ```

2.  **Setup the Backend:**
    ```sh
    # Navigate to the backend directory
    cd backend

    # Create a virtual environment
    python -m venv venv

    # Activate the virtual environment
    # On Windows:
    .\venv\Scripts\activate
    # On macOS/Linux:
    source venv/bin/activate

    # Install Python dependencies
    pip install -r requirements.txt
    ```

3.  **Setup the Frontend:**
    ```sh
    # Navigate to the frontend directory
    cd ../frontend

    # Install npm packages
    npm install
    ```

## Usage

1.  **Run the Backend Server:**
    *   Make sure you are in the `backend` directory with your virtual environment activated.
    *   Run the Uvicorn server:
    ```sh
    uvicorn app.main:app --reload
    ```
    *   The backend will be available at `http://127.0.0.1:8000`.

2.  **Run the Frontend Application:**
    *   Open a new terminal and navigate to the `frontend` directory.
    *   Start the Next.js development server:
    ```sh
    npm run dev
    ```
    *   Open your browser and go to `http://localhost:3001` to see the application.

## License

This project is licensed under the MIT License. See the `LICENSE.md` file for details.