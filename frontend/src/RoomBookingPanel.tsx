
import { useState } from "react";

const API = "/api";

type Room = {
  room_number: number;
  room_label: string;
  occupied: boolean;
};

type FloorData = {
  hostel: string;
  floor: number;
  group_id: string;
  already_booked: boolean;
  booked_room: { floor: number; room_number: number } | null;
  rooms: Room[];
};

async function api(path: string, options: RequestInit = {}) {
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
  let result: Record<string, unknown> = {};

  if (text) {
    try {
      result = JSON.parse(text) as Record<string, unknown>;
    } catch {
      throw new Error("Invalid server response.");
    }
  }

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : `Request failed (HTTP ${response.status}).`,
    );
  }

  return result;
}

export default function RoomBookingPanel() {
  const [pairCode, setPairCode] = useState("");
  const [floor, setFloor] = useState(1);
  const [data, setData] = useState<FloorData | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadFloor(code: string, selectedFloor: number) {
    const result = await api(
      `/rooms/floors?pair_code=${encodeURIComponent(code)}&floor=${selectedFloor}`,
    );

    setData(result as unknown as FloorData);
    setSelectedRoom(null);
  }

  async function validatePair(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setData(null);
    setSelectedRoom(null);
    setLoading(true);

    const code = pairCode.trim().toUpperCase();

    try {
      const result = await api("/rooms/validate-group", {
        method: "POST",
        body: JSON.stringify({ pair_code: code }),
      });

      setPairCode(code);
      setNotice(
        `Pair verified. Hostel: ${String(result.hostel)}.`,
      );

      await loadFloor(code, floor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not validate pair code.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function changeFloor(nextFloor: number) {
    setFloor(nextFloor);
    setError("");
    setNotice("");
    setLoading(true);

    try {
      await loadFloor(pairCode.trim().toUpperCase(), nextFloor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not load this floor.",
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmBooking() {
    if (selectedRoom === null || !data) return;

    const room = data.rooms.find(
      (item) => item.room_number === selectedRoom,
    );

    if (!room || room.occupied || data.already_booked) return;

    const confirmed = window.confirm(
      `Book room ${room.room_label} on Floor ${floor} in ${data.hostel}?`,
    );

    if (!confirmed) return;

    setBusy(true);
    setError("");
    setNotice("");

    try {
      const result = await api("/rooms/book", {
        method: "POST",
        body: JSON.stringify({
          pair_code: pairCode.trim().toUpperCase(),
          floor,
          room_number: selectedRoom,
        }),
      });

      setNotice(
        `Booking successful! Room ${String(result.room_label)} is reserved for your group.`,
      );

      await loadFloor(pairCode.trim().toUpperCase(), floor);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not book this room.",
      );

      try {
        await loadFloor(pairCode.trim().toUpperCase(), floor);
      } catch {
        // Keep the original booking error visible.
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="room-booking-panel">
      <p className="eyebrow">ROOM SELECTION</p>
      <h2>Book your room</h2>
      <p className="room-booking-description">
        Enter your accepted roommate group code to view your hostel's
        available rooms.
      </p>

      <form className="pair-code-form" onSubmit={validatePair}>
        <label htmlFor="pair-code">Unique pair code</label>

        <input
          id="pair-code"
          value={pairCode}
          onChange={(event) => setPairCode(event.target.value)}
          placeholder="e.g. QCLKT-A1B2C3D4"
          required
          maxLength={20}
        />

        <button
          type="submit"
          className="primary-button"
          disabled={loading || busy}
        >
          {loading ? "Checking..." : "Verify pair code"}
        </button>
      </form>

      {error && <div className="alert error">{error}</div>}
      {notice && <div className="alert success">{notice}</div>}

      {data && (
        <>
          <div className="booking-summary">
            <div>
              <span>Hostel</span>
              <strong>{data.hostel}</strong>
            </div>

            <div>
              <span>Group ID</span>
              <strong>{data.group_id}</strong>
            </div>
          </div>

          {data.already_booked ? (
            <div className="alert success">
              Your group already has a room booked
              {data.booked_room
                ? `: room ${data.booked_room.floor}${String(
                    data.booked_room.room_number,
                  ).padStart(2, "0")}.`
                : "."}
            </div>
          ) : (
            <>
              <div className="floor-selector">
                <label htmlFor="floor-select">Choose floor</label>

                <select
                  id="floor-select"
                  value={floor}
                  disabled={loading || busy}
                  onChange={(event) =>
                    void changeFloor(Number(event.target.value))
                  }
                >
                  {Array.from({ length: 14 }, (_, index) => index + 1).map(
                    (value) => (
                      <option key={value} value={value}>
                        Floor {value}
                      </option>
                    ),
                  )}
                </select>
              </div>

              <div className="room-legend">
                <span><i className="room-dot available" /> Available</span>
                <span><i className="room-dot occupied" /> Occupied</span>
                <span><i className="room-dot selected" /> Selected</span>
              </div>

              <div className="floor-plan">
                <div className="room-wing">
                  <h3>Left wing</h3>
                  <div className="room-grid">
                    {data.rooms
                      .filter((room) => room.room_number <= 20)
                      .map((room) => (
                        <button
                          type="button"
                          key={room.room_number}
                          className={[
                            "room-tile",
                            room.occupied ? "occupied" : "available",
                            selectedRoom === room.room_number ? "selected" : "",
                          ].join(" ")}
                          disabled={room.occupied || loading || busy}
                          title={
                            room.occupied
                              ? `Room ${room.room_label} is occupied`
                              : `Select room ${room.room_label}`
                          }
                          onClick={() => setSelectedRoom(room.room_number)}
                        >
                          {room.room_label}
                        </button>
                      ))}
                  </div>
                </div>

                <div className="lift-column">
                  <div className="lift-box">
                    <span>↕</span>
                    <strong>LIFT</strong>
                  </div>
                  <span className="corridor-label">CENTRAL</span>
                  <span className="corridor-label">CORRIDOR</span>
                </div>

                <div className="room-wing">
                  <h3>Right wing</h3>
                  <div className="room-grid">
                    {data.rooms
                      .filter((room) => room.room_number > 20)
                      .map((room) => (
                        <button
                          type="button"
                          key={room.room_number}
                          className={[
                            "room-tile",
                            room.occupied ? "occupied" : "available",
                            selectedRoom === room.room_number ? "selected" : "",
                          ].join(" ")}
                          disabled={room.occupied || loading || busy}
                          title={
                            room.occupied
                              ? `Room ${room.room_label} is occupied`
                              : `Select room ${room.room_label}`
                          }
                          onClick={() => setSelectedRoom(room.room_number)}
                        >
                          {room.room_label}
                        </button>
                      ))}
                  </div>
                </div>
              </div>

              {selectedRoom !== null && (
                <div className="selected-room">
                  <p>
                    Selected room:{" "}
                    <strong>
                      {data.rooms.find(
                        (room) => room.room_number === selectedRoom,
                      )?.room_label}
                    </strong>
                  </p>

                  <button
                    type="button"
                    className="primary-button"
                    disabled={busy || loading}
                    onClick={() => void confirmBooking()}
                  >
                    {busy ? "Booking..." : "Confirm room booking"}
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
