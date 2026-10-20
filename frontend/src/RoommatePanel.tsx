
import { useCallback, useEffect, useState } from "react";

const API = "/api/auth/login";

type StudentSummary = {
  id: string;
  roll_number: string;
  full_name: string;
};

type Invitation = {
  id: string;
  student: StudentSummary;
};

type RoommateData = {
  group: {
    group_id: string;
    partner: StudentSummary;
    created_at: string;
  } | null;
  incoming: Invitation[];
  outgoing: Invitation[];
};

async function apiRequest(
  path: string,
  options: RequestInit = {},
) {
  let response: Response;

  try {
    response = await fetch(`${API}${path}`, {
      ...options,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Cannot connect to the quickCLKT backend.");
  }

  const text = await response.text();
  let data: Record<string, unknown> = {};

  if (text) {
    try {
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("The server returned an invalid response.");
    }
  }

  if (!response.ok) {
    const detail = data.detail;
    throw new Error(
      typeof detail === "string"
        ? detail
        : `Request failed (HTTP ${response.status}).`,
    );
  }

  return data;
}

export default function RoommatePanel() {
  const [data, setData] = useState<RoommateData | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    const result = await apiRequest("/roommates");
    setData(result as unknown as RoommateData);
  }, []);

  useEffect(() => {
    let active = true;

    apiRequest("/roommates")
      .then((result) => {
        if (active) {
          setData(result as unknown as RoommateData);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setError(
            err instanceof Error ? err.message : "Could not load roommates.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const result = await apiRequest("/roommates/invite", {
        method: "POST",
        body: JSON.stringify({
          roll_number: rollNumber.trim(),
        }),
      });

      setNotice(String(result.message || "Invitation sent."));
      setRollNumber("");
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not send invitation.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function respond(invitationId: string, accept: boolean) {
    setError("");
    setNotice("");
    setBusy(true);

    try {
      const result = await apiRequest(
        `/roommates/invitations/${invitationId}/respond`,
        {
          method: "POST",
          body: JSON.stringify({ accept }),
        },
      );

      setNotice(String(result.message || "Response submitted."));
      await refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not respond to invitation.",
      );
      try {
        await refresh();
      } catch {
        // Preserve the original error if refreshing also fails.
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <section className="roommate-panel">
        <p>Loading roommate information...</p>
      </section>
    );
  }

  if (!data) {
    return (
      <section className="roommate-panel">
        <h2>Roommate registration</h2>
        <div className="alert error">
          {error || "Could not load roommate information."}
        </div>
        <button
          type="button"
          className="secondary-button"
          onClick={() => {
            setLoading(true);
            setError("");
            refresh()
              .catch((err: unknown) =>
                setError(
                  err instanceof Error ? err.message : "Refresh failed.",
                ),
              )
              .finally(() => setLoading(false));
          }}
        >
          Try again
        </button>
      </section>
    );
  }

  return (
    <section className="roommate-panel">
      <p className="eyebrow">ROOMMATE REGISTRATION</p>
      <h2>Your roommate group</h2>
      <p className="roommate-description">
        Invite one student to form your two-person room booking group.
      </p>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {data.group ? (
        <div className="group-card">
          <p className="muted">YOUR UNIQUE GROUP ID</p>
          <h3 className="group-id">{data.group.group_id}</h3>

          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              void navigator.clipboard
                .writeText(data.group!.group_id)
                .then(() => setNotice("Group ID copied."))
                .catch(() => setError("Could not copy the group ID."));
            }}
          >
            Copy group ID
          </button>

          <div className="partner-details">
            <strong>Your roommate</strong>
            <p>{data.group.partner.full_name}</p>
            <p>Roll number: {data.group.partner.roll_number}</p>
          </div>

          <p className="muted">
            Your group is created. Both students should keep this ID for
            future room booking.
          </p>
        </div>
      ) : (
        <>
          <form className="roommate-form" onSubmit={sendInvitation}>
            <label htmlFor="roommate-roll">
              Roommate's college roll number
            </label>

            <input
              id="roommate-roll"
              required
              minLength={2}
              maxLength={40}
              value={rollNumber}
              onChange={(event) => setRollNumber(event.target.value)}
              placeholder="Enter your roommate's roll number"
            />

            <button
              type="submit"
              className="primary-button"
              disabled={busy}
            >
              {busy ? "Please wait..." : "Send invitation"}
            </button>
          </form>

          {data.incoming.length > 0 && (
            <div className="invitation-section">
              <h3>Incoming invitations</h3>

              {data.incoming.map((invitation) => (
                <div className="invitation-card" key={invitation.id}>
                  <div>
                    <strong>{invitation.student.full_name}</strong>
                    <p>Roll number: {invitation.student.roll_number}</p>
                  </div>

                  <div className="invitation-actions">
                    <button
                      type="button"
                      className="primary-button"
                      disabled={busy}
                      onClick={() => void respond(invitation.id, true)}
                    >
                      Accept
                    </button>

                    <button
                      type="button"
                      className="secondary-button"
                      disabled={busy}
                      onClick={() => void respond(invitation.id, false)}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.outgoing.length > 0 && (
            <div className="invitation-section">
              <h3>Sent invitations</h3>

              {data.outgoing.map((invitation) => (
                <div className="invitation-card" key={invitation.id}>
                  <div>
                    <strong>{invitation.student.full_name}</strong>
                    <p>Roll number: {invitation.student.roll_number}</p>
                  </div>
                  <span className="pending-label">Pending response</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
