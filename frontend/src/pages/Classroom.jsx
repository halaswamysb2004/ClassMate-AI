import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AutoTeacher from "./AutoTeacher";

import { API } from "../config";

function getSavedChild() {
  try {
    return JSON.parse(sessionStorage.getItem("active_child") || "null");
  } catch {
    return null;
  }
}

export default function Classroom({ child: passedChild }) {
  const navigate = useNavigate();

  const [child] = useState(() => passedChild || getSavedChild());
  const [showParentAccess, setShowParentAccess] = useState(false);
  const [password, setPassword] = useState("");
  const [verified, setVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    document.title = "ClassMate AI - Classroom";

    return () => {
      document.title = "ClassMate AI";
    };
  }, []);

  async function verifyParent(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      const response = await fetch(
        `${API}/api/auth/verify-parent`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ password })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Parent verification failed.");
      }

      setVerified(true);
      setPassword("");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function endClass() {
    setError("");
    setLoading(true);

    try {
      const token =
        localStorage.getItem("access_token") ||
        localStorage.getItem("token");

      const savedSession = JSON.parse(
        sessionStorage.getItem("active_session") || "null"
      );

      const sessionId = savedSession?.id;

      if (!sessionId) {
        throw new Error("Active session information was not found.");
      }

      const response = await fetch(
        `${API}/api/sessions/${sessionId}/pause`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to pause the class.");
      }

      // Exit fullscreen before returning to dashboard.
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }

      sessionStorage.removeItem("classroom_active");
      sessionStorage.removeItem("class_start_authorized");

      navigate("/dashboard");

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    setLoading(true);

    // Exit fullscreen.
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch (err) {
        console.error("Could not exit fullscreen:", err);
      }
    }

    sessionStorage.removeItem("active_session");
    sessionStorage.removeItem("active_child");
    sessionStorage.removeItem("classroom_active");
    sessionStorage.removeItem("class_start_authorized");

    localStorage.removeItem("access_token");
    localStorage.removeItem("token");

    navigate("/login", { replace: true });
  }

  function closeParentAccess() {
    setShowParentAccess(false);
    setVerified(false);
    setPassword("");
    setError("");
  }

  if (!child) {
    return <main className="classroom">Please select a child profile.</main>;
  }

  return (
    <main className="classroom classroom-redesign">

      <header className="classroom-header">
        <div className="brand">
          <span>🌈</span>
          <div>
            <h1>ClassMate AI</h1>
            <small>My Learning Adventure</small>
          </div>
        </div>

        <div className="classroom-child">
          <span>🧒</span>
          <div>
            <strong>{child.name}</strong>
            <small>Age {child.age}</small>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setShowParentAccess(true);
            setVerified(false);
            setError("");
          }}
          style={{
            padding: "10px 15px",
            borderRadius: "10px",
            border: "1px solid #cbd5e1",
            background: "#ffffff",
            color: "#1e293b",
            cursor: "pointer",
            fontWeight: "600"
          }}
        >
          🔒 Parent Access
        </button>
      </header>

      <AutoTeacher child={child} />

      <footer className="classroom-footer">
        Learn • Practise • Play • Grow ⭐
      </footer>

      {showParentAccess && (
        <div
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeParentAccess();
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.65)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "20px"
          }}
        >
          <div
            style={{
              background: "#ffffff",
              padding: "28px",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "380px",
              color: "#1e293b",
              boxShadow: "0 20px 50px rgba(0,0,0,0.2)"
            }}
          >
            {!verified ? (
              <>
                <h2>🔐 Parent Verification</h2>

                <p>Only parents can access classroom controls.</p>

                <form onSubmit={verifyParent}>
                  <input
                    type="password"
                    placeholder="Enter parent password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    required
                    style={{
                      width: "100%",
                      padding: "12px",
                      marginBottom: "15px",
                      boxSizing: "border-box",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1"
                    }}
                  />

                  <button
                    type="submit"
                    disabled={loading}
                    style={{
                      width: "100%",
                      padding: "12px",
                      background: "#2563eb",
                      color: "white",
                      border: "none",
                      borderRadius: "8px",
                      cursor: "pointer"
                    }}
                  >
                    {loading ? "Verifying..." : "Verify Parent"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <h2>👨‍👩‍👧 Parent Controls</h2>

                <p>Parent verification successful.</p>

                <button
                  onClick={endClass}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    marginBottom: "12px",
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  {loading
                    ? "Please wait..."
                    : "End Class & Return to Dashboard"}
                </button>

                <button
                  onClick={logout}
                  disabled={loading}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "#dc2626",
                    color: "white",
                    border: "none",
                    borderRadius: "8px",
                    cursor: "pointer"
                  }}
                >
                  Logout
                </button>
              </>
            )}

            {error && (
              <p style={{ color: "#dc2626", marginTop: "12px" }}>
                {error}
              </p>
            )}

            <button
              onClick={closeParentAccess}
              disabled={loading}
              style={{
                width: "100%",
                padding: "10px",
                marginTop: "15px",
                background: "#e2e8f0",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer"
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </main>
  );
}
