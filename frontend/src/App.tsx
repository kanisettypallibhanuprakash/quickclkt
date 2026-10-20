import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import "./index.css";
import RoommatePanel from "./RoommatePanel";
const API = "/api";
import RoomBookingPanel from "./RoomBookingPanel";
type Student = {
  id: string;
  roll_number: string;
  full_name: string;
  email: string;
  academic_year: number;
  course: string;
  mobile_number: string;
  hostel_name: string | null;
  is_verified: boolean;
};

type ApiResponse = {
  message?: string;
  detail?: string | { msg?: string }[];
  student?: Student;
};

const hostels = ["Ashwatha", "Ashoka", "Annex", "Jasmine"];

async function request(
  path: string,
  options: RequestInit = {},
): Promise<ApiResponse> {
  let response: Response;

  try {
    const headers = new Headers(options.headers);

    if (options.body && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }

    response = await fetch(`${API}${path}`, {
      ...options,
      headers,
      credentials: "include",
    });
  } catch {
    throw new Error(
      "Cannot connect to the server. Make sure the backend is running at /api/auth/login.",
    );
  }

  const text = await response.text();
  let data: ApiResponse = {};

  if (text) {
    try {
      data = JSON.parse(text) as ApiResponse;
    } catch {
      throw new Error(`Invalid server response (HTTP ${response.status}).`);
    }
  }

  if (!response.ok) {
    let message = `Request failed (HTTP ${response.status}).`;

    if (typeof data.detail === "string") {
      message = data.detail;
    } else if (Array.isArray(data.detail)) {
      message = data.detail
        .map((item) => item.msg || "Invalid input")
        .join(". ");
    } else if (data.message) {
      message = data.message;
    }

    throw new Error(message);
  }

  return data;
}

export default function App() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [fullName, setFullName] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [email, setEmail] = useState("");
  const [year, setYear] = useState("2");
  const [course, setCourse] = useState("B.Tech CSE");
  const [mobile, setMobile] = useState("");
  const [hostel, setHostel] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    let active = true;

    request("/auth/me")
      .then((data) => {
        if (active && data.student) {
          setStudent(data.student);
        }
      })
      .catch(() => {
        if (active) setStudent(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function changeMode(newMode: "login" | "register") {
    setMode(newMode);
    setError("");
    setNotice("");
    setPassword("");
    setConfirmPassword("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (submitting) return;

    if (mode === "register") {
      if (password.length < 8) {
        setError("Password must contain at least 8 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
    }

    setSubmitting(true);

    try {
      if (mode === "register") {
        const data = await request("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            full_name: fullName.trim(),
            roll_number: rollNumber.trim(),
            email: email.trim(),
            academic_year: Number(year),
            course: course.trim(),
            mobile_number: mobile.trim(),
            hostel_name: hostel || null,
            password,
          }),
        });

        setNotice(
          data.message || "Account created. You can now log in.",
        );
        setMode("login");
        setPassword("");
        setConfirmPassword("");
      } else {
        const data = await request("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            roll_number: rollNumber.trim(),
            password,
          }),
        });

        if (!data.student) {
          throw new Error("Student details were missing from the response.");
        }

        setStudent(data.student);
        setNotice(data.message || "Login successful.");
        setPassword("");
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDemoLogin(demoRollNumber: string) {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      const data = await request("/auth/login", {
        method: "POST",
        body: JSON.stringify({
          roll_number: demoRollNumber,
          password: "Demo@12345",
        }),
      });

      if (!data.student) {
        throw new Error("Student details were missing from the response.");
      }

      setStudent(data.student);
      setNotice("Demo login successful.");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Demo login failed. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLogout() {
    setError("");
    setNotice("");
    setSubmitting(true);

    try {
      await request("/auth/logout", { method: "POST" });
      setStudent(null);
      setMode("login");
      setPassword("");
      setNotice("You have logged out successfully.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Logout failed.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="page loading">
        Loading quickCLKT...
      </main>
    );
  }

  if (student) {
    return (
      <main className="page">
        <header className="topbar">
          <div className="logo">QC</div>

          <div>
            <strong>quickCLKT</strong>
            <p>Student room booking portal</p>
          </div>

          <button
            type="button"
            className="secondary-button logout"
            onClick={handleLogout}
            disabled={submitting}
          >
            {submitting ? "Please wait..." : "Log out"}
          </button>
        </header>

        <section className="dashboard">
          <p className="eyebrow">STUDENT DASHBOARD</p>
          <h1>Welcome, {student.full_name}</h1>

          <p className="muted">
            Roll number: <strong>{student.roll_number}</strong>
          </p>

          {!student.is_verified && (
            <div className="alert warning">
              <strong>Verification pending</strong>
              <p>
                Your student identity has not yet been verified.
                Room booking will remain unavailable until verification
                is implemented.
              </p>
            </div>
          )}

          <div className="profile-grid">
            <Profile label="Roll number" value={student.roll_number} />
            <Profile label="Email" value={student.email} />
            <Profile
              label="Academic year"
              value={`Year ${student.academic_year}`}
            />
            <Profile label="Course" value={student.course} />
            <Profile label="Mobile number" value={student.mobile_number} />
            <Profile
              label="Hostel"
              value={student.hostel_name || "Not assigned"}
            />
          </div>
          <RoommatePanel />
          <RoomBookingPanel />
          <div className="future-box">
            <strong>Next: roommate registration</strong>
            <p>
              Group creation, roommate invitations and room booking
              will be added in the next development stage.
            </p>
          </div>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}
        </section>

        <footer>quickCLKT · Student Room Booking Portal</footer>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="topbar">
        <div className="logo">QC</div>

        <div>
          <strong>quickCLKT</strong>
          <p>Student room booking portal</p>
        </div>

        <span className="topbar-label">STUDENT PORTAL</span>
      </header>

      <section className="layout">
        <div className="intro">
          <p className="eyebrow">YOUR CAMPUS, YOUR SPACE</p>

          <h1>
            Room selection,
            <br />
            <span>made simpler.</span>
          </h1>

          <p className="intro-text">
            Create your student account and get ready to find
            your room with your preferred roommate.
          </p>

          <div className="hostel-list">
            {hostels.map((name) => (
              <span key={name}>{name}</span>
            ))}
          </div>

          <p className="intro-note">Designed for 2-sharing rooms</p>
        </div>

        <section className="auth-card">
          <div className="tabs">
            <button
              type="button"
              className={mode === "login" ? "tab active" : "tab"}
              onClick={() => changeMode("login")}
            >
              Log in
            </button>

            <button
              type="button"
              className={mode === "register" ? "tab active" : "tab"}
              onClick={() => changeMode("register")}
            >
              Create account
            </button>
          </div>

          <div className="form-heading">
            <h2>
              {mode === "login" ? "Welcome back" : "Create your account"}
            </h2>
            <p>
              {mode === "login"
                ? "Enter your roll number and password."
                : "Enter your student details below."}
            </p>
          </div>

          {notice && <div className="alert success">{notice}</div>}
          {error && <div className="alert error">{error}</div>}

          <form onSubmit={handleSubmit}>
            {mode === "register" && (
              <Field label="Full name">
                <input
                  required
                  minLength={2}
                  maxLength={120}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                />
              </Field>
            )}

            <Field label="Roll number">
              <input
                required
                minLength={2}
                maxLength={40}
                autoComplete="username"
                value={rollNumber}
                onChange={(e) => setRollNumber(e.target.value)}
                placeholder="Your college roll number"
              />
            </Field>

            {mode === "register" && (
              <>
                <Field label="College email">
                  <input
                    required
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@college.edu"
                  />
                </Field>

                <div className="field-row">
                  <Field label="Academic year">
                    <select
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6].map((value) => (
                        <option key={value} value={value}>
                          Year {value}
                        </option>
                      ))}
                    </select>
                  </Field>

                  <Field label="Course">
                    <input
                      required
                      minLength={2}
                      maxLength={100}
                      value={course}
                      onChange={(e) => setCourse(e.target.value)}
                      placeholder="B.Tech CSE"
                    />
                  </Field>
                </div>

                <Field label="Mobile number">
                  <input
                    required
                    type="tel"
                    minLength={7}
                    maxLength={25}
                    autoComplete="tel"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    placeholder="Enter mobile number"
                  />
                </Field>

                <Field label="Hostel (if assigned)">
                  <select
                    value={hostel}
                    onChange={(e) => setHostel(e.target.value)}
                  >
                    <option value="">Not assigned yet</option>
                    {hostels.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}

            <Field label="Password">
              <input
                required
                type="password"
                minLength={mode === "register" ? 8 : 1}
                maxLength={128}
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  mode === "login"
                    ? "Enter your password"
                    : "Create a password"
                }
              />
            </Field>

            {mode === "register" && (
              <Field label="Confirm password">
                <input
                  required
                  type="password"
                  minLength={8}
                  maxLength={128}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Enter password again"
                />
              </Field>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={submitting}
            >
              {submitting
                ? "Please wait..."
                : mode === "login"
                  ? "Log in →"
                  : "Create account →"}
            </button>
          </form>

          {mode === "login" && (
            <div className="demo-login-section">
              <div className="demo-divider"><span>OR TRY A DEMO</span></div>
              <h3>Just exploring?</h3>
              <p>Enter quickCLKT using a sample student account.</p>

              <button
                type="button"
                className="demo-login-button"
                onClick={() => handleDemoLogin("DEMO001")}
                disabled={submitting}
              >
                <span className="demo-login-icon" aria-hidden="true">👨‍🎓</span>
                <span className="demo-login-copy">
                  <strong>Demo Student 1</strong>
                  <small>Explore the student dashboard</small>
                </span>
                <span className="demo-login-arrow" aria-hidden="true">→</span>
              </button>

              <button
                type="button"
                className="demo-login-button"
                onClick={() => handleDemoLogin("DEMO002")}
                disabled={submitting}
              >
                <span className="demo-login-icon" aria-hidden="true">👨‍🎓</span>
                <span className="demo-login-copy">
                  <strong>Demo Student 2</strong>
                  <small>Explore the roommate workflow</small>
                </span>
                <span className="demo-login-arrow" aria-hidden="true">→</span>
              </button>
            </div>
          )}

          <p className="security-note">
            Passwords are hashed on the server.
          </p>
        </section>
      </section>

      <footer>quickCLKT · Student Room Booking Portal</footer>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
    </div>
  );
}

function Profile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="profile-item">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
