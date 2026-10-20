import { useCallback, useEffect, useState } from "react";

type StudentSummary = { id: string; roll_number: string; full_name: string };
type Invitation = { id: string; student: StudentSummary };
type RoommateStatus = {
  group: { group_id: string; partner: StudentSummary; created_at: string } | null;
  incoming: Invitation[];
  outgoing: Invitation[];
};
type ApiError = { detail?: string | { msg?: string }[]; message?: string };

const API = "/api";

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  let response: Response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers, credentials: "include" });
  } catch {
    throw new Error("Cannot connect to quickCLKT server. Please try again.");
  }
  const text = await response.text();
  let data: unknown = {};
  if (text) {
    try { data = JSON.parse(text); }
    catch { throw new Error(`Invalid server response (HTTP ${response.status}).`); }
  }
  if (!response.ok) {
    const err = data as ApiError;
    let message = `Request failed (HTTP ${response.status}).`;
    if (typeof err.detail === "string") message = err.detail;
    else if (Array.isArray(err.detail)) message = err.detail.map((item) => item.msg || "Invalid input").join(". ");
    else if (err.message) message = err.message;
    throw new Error(message);
  }
  return data as T;
}

export default function RoommatePanel() {
  const [status, setStatus] = useState<RoommateStatus | null>(null);
  const [rollNumber, setRollNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStatus = useCallback(async () => {
    setError("");
    try {
      setStatus(await apiRequest<RoommateStatus>("/roommates"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load roommate details.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  async function sendInvitation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(""); setNotice(""); setSubmitting(true);
    try {
      const result = await apiRequest<{ message: string }>("/roommates/invite", {
        method: "POST", body: JSON.stringify({ roll_number: rollNumber.trim() }),
      });
      setNotice(result.message || "Roommate invitation sent."); setRollNumber(""); await loadStatus();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not send invitation."); }
    finally { setSubmitting(false); }
  }

  async function respond(id: string, accept: boolean) {
    setError(""); setNotice(""); setSubmitting(true);
    try {
      const result = await apiRequest<{ message: string }>(`/roommates/invitations/${encodeURIComponent(id)}/respond`, {
        method: "POST", body: JSON.stringify({ accept }),
      });
      setNotice(result.message || (accept ? "Invitation accepted." : "Invitation declined.")); await loadStatus();
    } catch (e) { setError(e instanceof Error ? e.message : "Could not respond to invitation."); }
    finally { setSubmitting(false); }
  }

  const panelStyle: React.CSSProperties = { marginTop: 24, padding: 24, border: "1px solid #dfe7f1", borderRadius: 20, background: "#fff" };
  const buttonStyle: React.CSSProperties = { padding: "10px 15px", border: "1px solid #cbd5e1", borderRadius: 9, background: "#fff", cursor: "pointer" };

  return <section className="roommate-panel" style={panelStyle}>
    <h2 style={{ marginTop: 0 }}>Roommate registration</h2>
    <p style={{ color: "#64748b" }}>Send an invitation using your roommate's college roll number. They must accept before the group is created.</p>
    {error && <div role="alert" style={{ padding: 12, margin: "12px 0", borderRadius: 10, background: "#fff1f2", color: "#b91c1c" }}>{error}</div>}
    {notice && <div role="status" style={{ padding: 12, margin: "12px 0", borderRadius: 10, background: "#ecfdf5", color: "#047857" }}>{notice}</div>}
    {loading ? <p>Loading roommate details...</p> : status?.group ? <div style={{ padding: 16, borderRadius: 12, background: "#f0f7ff" }}>
      <h3 style={{ marginTop: 0 }}>Your roommate group is ready</h3><p><strong>Group code:</strong> {status.group.group_id}</p>
      <p><strong>Roommate:</strong> {status.group.partner.full_name} ({status.group.partner.roll_number})</p>
      <p style={{ color: "#64748b" }}>Keep this group code for room booking.</p>
    </div> : <>
      <form onSubmit={sendInvitation} style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
        <input aria-label="Roommate roll number" required minLength={2} maxLength={40} value={rollNumber} onChange={e => setRollNumber(e.target.value)} placeholder="Enter roommate's roll number" style={{ flex: "1 1 240px", minWidth: 0, padding: 12, border: "1px solid #cbd5e1", borderRadius: 10 }} />
        <button type="submit" disabled={submitting} style={{ ...buttonStyle, background: "#2563eb", color: "white", border: 0 }}>{submitting ? "Please wait..." : "Send invitation"}</button>
      </form>
      {!!status?.outgoing.length && <div style={{ marginTop: 20 }}><h3>Sent invitations</h3>{status.outgoing.map(inv => <p key={inv.id}>{inv.student.full_name} ({inv.student.roll_number}) — awaiting response</p>)}</div>}
      {!!status?.incoming.length && <div style={{ marginTop: 20 }}><h3>Invitations received</h3>{status.incoming.map(inv => <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", padding: "12px 0", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ flex: "1 1 200px" }}><strong>{inv.student.full_name}</strong><div style={{ color: "#64748b", fontSize: 14 }}>{inv.student.roll_number}</div></div>
        <button type="button" disabled={submitting} onClick={() => void respond(inv.id, true)} style={{ ...buttonStyle, background: "#16a34a", color: "white", border: 0 }}>Accept</button>
        <button type="button" disabled={submitting} onClick={() => void respond(inv.id, false)} style={buttonStyle}>Decline</button>
      </div>)}</div>}
    </>}
    <button type="button" onClick={() => void loadStatus()} disabled={loading || submitting} style={{ ...buttonStyle, marginTop: 16 }}>Refresh</button>
  </section>;
}
