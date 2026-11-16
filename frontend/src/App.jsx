import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  useLocation,
  useNavigate
} from "react-router-dom";

import { useEffect } from "react";

import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import ClassroomGate from "./pages/ClassroomGate";
import WritingPractice from "./pages/WritingPractice";

// Protect navigation while a classroom session is active
function ClassroomNavigationGuard() {
  const location = useLocation();
  const navigate = useNavigate();

  const classroomActive =
    sessionStorage.getItem("classroom_active") === "true";

  useEffect(() => {
    if (!classroomActive) return;

    const allowedPaths = ["/classroom", "/writing"];

    if (!allowedPaths.includes(location.pathname)) {
      navigate("/classroom", { replace: true });
    }
  }, [classroomActive, location.pathname, navigate]);

  // Discourage browser Back navigation during class
  useEffect(() => {
    if (!classroomActive) return;

    const protectBackButton = () => {
      window.history.pushState(null, "", window.location.href);
    };

    window.history.pushState(null, "", window.location.href);

    window.addEventListener("popstate", protectBackButton);

    return () => {
      window.removeEventListener("popstate", protectBackButton);
    };
  }, [classroomActive]);

  // Block common navigation and developer-tool shortcuts where possible
  useEffect(() => {
    if (!classroomActive) return;

    const blockShortcuts = (event) => {
      const key = event.key.toLowerCase();

      const blocked =
        event.key === "F5" ||
        event.key === "F12" ||
        event.key === "F11" ||
        (event.ctrlKey && ["r", "w", "l"].includes(key)) ||
        (event.ctrlKey &&
          event.shiftKey &&
          ["i", "j", "c"].includes(key)) ||
        (event.altKey && event.key === "ArrowLeft") ||
        (event.altKey && event.key === "ArrowRight");

      if (blocked) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    const blockRightClick = (event) => {
      event.preventDefault();
    };

    document.addEventListener("keydown", blockShortcuts, true);
    document.addEventListener("contextmenu", blockRightClick);

    return () => {
      document.removeEventListener("keydown", blockShortcuts, true);
      document.removeEventListener("contextmenu", blockRightClick);
    };
  }, [classroomActive]);

  return null;
}

function DashboardGate() {
  if (sessionStorage.getItem("classroom_active") === "true") {
    return <Navigate to="/classroom" replace />;
  }

  return <Dashboard />;
}

function WritingPracticeGate() {
  const active =
    sessionStorage.getItem("classroom_active") === "true";

  const child = sessionStorage.getItem("active_child");

  if (!active || !child) {
    return <Navigate to="/login" replace />;
  }

  return <WritingPractice />;
}

function ParentRouteGate({ children }) {
  if (sessionStorage.getItem("classroom_active") === "true") {
    return <Navigate to="/classroom" replace />;
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <ClassroomNavigationGuard />

      <Routes>
        <Route
          path="/"
          element={
            <ParentRouteGate>
              <Home />
            </ParentRouteGate>
          }
        />

        <Route
          path="/login"
          element={
            <ParentRouteGate>
              <Login />
            </ParentRouteGate>
          }
        />

        <Route
          path="/register"
          element={
            <ParentRouteGate>
              <Register />
            </ParentRouteGate>
          }
        />

        <Route
          path="/dashboard"
          element={<DashboardGate />}
        />

        <Route
          path="/classroom"
          element={<ClassroomGate />}
        />

        <Route
          path="/writing"
          element={<WritingPracticeGate />}
        />

        <Route
          path="*"
          element={<Navigate to="/" replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
