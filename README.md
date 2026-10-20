# quickCLKT — Student Room Booking Portal

**🌐 Live Website:** https://quickclkt.vercel.app/

quickCLKT is a student room-booking application that helps students find a roommate, create a roommate group, and reserve a room together through a unique group code.

## 🚀 How to Use quickCLKT

### Step 1: Create Your Account

1. Open the [quickCLKT website](https://quickclkt.vercel.app/).
2. Click **Create account**.
3. Enter your name, college roll number, email, academic year, course, mobile number, password, and hostel (if assigned).
4. Submit the form.
5. Log in using your college roll number and password.

### Step 2: Invite Your Roommate

1. Your preferred roommate must also have a quickCLKT account.
2. Log in and open the **Roommate registration** section.
3. Enter your roommate's registered college roll number.
4. Click **Send invitation**.

### Step 3: Get Your Roommate's Acceptance

1. Your roommate logs in to their own account.
2. They open the roommate registration panel and refresh it if necessary.
3. They review your invitation and click **Accept**.

Once the invitation is accepted, quickCLKT creates a roommate group for both students.

### Step 4: Get Your Unique Group Code

After acceptance, the application generates a unique roommate group code, such as `QCLKT-XXXXXXXX`.

- Keep the actual code displayed by the application.
- Both students should retain the code.
- You need this code to proceed with room booking.

### Step 5: Verify Your Group

1. Open the **Book your room** section.
2. Enter your unique roommate group code.
3. Click **Verify pair code**.
4. The application validates your group and displays the associated hostel and room availability.

### Step 6: Select and Book Your Room

1. Select your preferred floor.
2. View the room layout and availability.
3. Choose an available room. Occupied rooms cannot be selected.
4. Click **Confirm room booking**.
5. Confirm your selection.

Once booking succeeds, the room is reserved for your roommate group.

**Important:** Both students must have accounts, and the roommate invitation must be accepted before a group code is generated. Both students must also satisfy the application's hostel requirements for booking.

## ✨ Features

- Student registration and login
- Secure password hashing
- Session-based authentication
- Roommate invitations
- Accepting or declining roommate requests
- Unique roommate group code generation
- Hostel and floor-based room selection
- Real-time availability from booking records
- Room booking with duplicate-booking protection
- Demo-account section on the login page

## 🏢 Supported Hostels

- Ashwatha
- Ashoka
- Annex
- Jasmine

The application is configured for **14 floors and 40 rooms per floor** in each hostel.

## 🛠️ Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, TypeScript, Vite |
| Backend | Python, FastAPI |
| Database | PostgreSQL, SQLAlchemy |
| Authentication | JWT in an HTTP-only cookie |
| Frontend deployment | Vercel |
| Backend deployment | Render |
| Database hosting | Neon |

## 📁 Project Structure

```text
quickclkt/
├── backend/
│   ├── main.py
│   └── requirements.txt
└── frontend/
    ├── src/
    │   ├── App.tsx
    │   ├── RoommatePanel.tsx
    │   └── RoomBookingPanel.tsx
    ├── vercel.json
    └── package.json
```

## 💻 Run Locally

### Backend Setup

1. Open a terminal in the `backend` directory.
2. Create and activate a Python virtual environment.
3. Install dependencies:

   ```bash
   pip install -r requirements.txt
   ```

4. Configure the required environment variables, including `DATABASE_URL` and `SECRET_KEY`.
5. Start the backend:

   ```bash
   uvicorn main:app --reload
   ```

6. Open the API documentation at http://127.0.0.1:8000/docs.

### Frontend Setup

1. Open another terminal in the `frontend` directory.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open the local URL printed by Vite, usually http://localhost:5173.

## 🔐 Security Notes

- Passwords are hashed by the backend.
- Session authentication uses an HTTP-only cookie.
- Never commit `.env` files, database credentials, JWT secrets, or real student passwords to GitHub.
- Demo credentials work only if the corresponding accounts exist in the deployed database.

## 🌐 Try the Application

**Live deployment:** https://quickclkt.vercel.app/

Create an account, invite a roommate, accept the invitation from the other account, obtain the generated group code, and use it to book a room.

---

*quickCLKT — Making campus room selection simpler.*
