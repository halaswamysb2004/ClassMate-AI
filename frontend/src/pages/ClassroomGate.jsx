import { Navigate } from "react-router-dom";
import Classroom from "./Classroom";

export default function ClassroomGate() {
  const active = sessionStorage.getItem("classroom_active");
  const childData = sessionStorage.getItem("active_child");

  if (active !== "true" || !childData) {
    return <Navigate to="/dashboard" replace />;
  }

  let child;

  try {
    child = JSON.parse(childData);
  } catch {
    sessionStorage.removeItem("classroom_active");
    sessionStorage.removeItem("active_child");
    return <Navigate to="/dashboard" replace />;
  }

  return <Classroom child={child} />;
}
