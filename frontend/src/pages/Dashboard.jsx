import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const API = "http://localhost:8000";

function Dashboard() {
  const navigate = useNavigate();

  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [startingChildId, setStartingChildId] = useState(null);

  // Curriculum selection
  const [classes, setClasses] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [selectedClassId, setSelectedClassId] = useState("lkg");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedUnitId, setSelectedUnitId] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [curriculumLoading, setCurriculumLoading] = useState(true);

  const [form, setForm] = useState({
    name: "",
    age: 5,
    language: "English",
    learning_level: "Beginner"
  });

  const token =
    localStorage.getItem("access_token") ||
    localStorage.getItem("token");

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    loadChildren();
  }, []);

  // Load available classes from MongoDB.
  useEffect(() => {
    async function loadClasses() {
      try {
        const response = await fetch(`${API}/api/curriculum/classes`);
        if (!response.ok) throw new Error("Unable to load classes.");

        const data = await response.json();
        const available = data.classes || [];
        setClasses(available);

        if (!available.some(item => item.class_id === "lkg")) {
          setSelectedClassId(available[0]?.class_id || "");
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setCurriculumLoading(false);
      }
    }

    loadClasses();
  }, []);

  // Load subjects whenever the selected class changes.
  useEffect(() => {
    if (!selectedClassId) return;

    async function loadSubjects() {
      try {
        const response = await fetch(
          `${API}/api/curriculum/${selectedClassId}/subjects`
        );
        if (!response.ok) throw new Error("Unable to load subjects.");

        const data = await response.json();
        const available = data.subjects || [];
        setSubjects(available);

        setSelectedSubjectId(previous =>
          available.some(item => item.id === previous)
            ? previous
            : available[0]?.id || ""
        );
      } catch (err) {
        setError(err.message);
      }
    }

    loadSubjects();
  }, [selectedClassId]);

  const selectedSubject = subjects.find(
    subject => subject.id === selectedSubjectId
  );

  const selectedUnit = selectedSubject?.units?.find(
    unit => unit.id === selectedUnitId
  );

  // Keep the selected unit and topic valid when the subject changes.
  useEffect(() => {
    const firstUnit = selectedSubject?.units?.[0];

    setSelectedUnitId(firstUnit?.id || "");
    setSelectedTopic(firstUnit?.topics?.[0] || "");
  }, [selectedSubjectId, subjects]);

  const availableUnits = selectedSubject?.units || [];
  const availableTopics = selectedUnit?.topics || [];

  async function loadChildren() {
    try {
      const response = await fetch(`${API}/api/children/`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      if (response.status === 401 || response.status === 403) {
        localStorage.removeItem("access_token");
        localStorage.removeItem("token");
        navigate("/login");
        return;
      }

      if (!response.ok) {
        throw new Error("Could not load child profiles.");
      }

      const data = await response.json();
      setChildren(data.children || []);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addChild(event) {
    event.preventDefault();
    setError("");

    try {
      const response = await fetch(`${API}/api/children/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...form,
          age: Number(form.age)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || "Unable to add child.");
      }

      setForm({
        name: "",
        age: 5,
        language: "English",
        learning_level: "Beginner"
      });

      setShowForm(false);
      await loadChildren();

    } catch (err) {
      setError(err.message);
    }
  }

  function logout() {
    sessionStorage.removeItem("active_session");
    sessionStorage.removeItem("active_child");
    sessionStorage.removeItem("classroom_active");
    sessionStorage.removeItem("class_start_authorized");

    localStorage.removeItem("access_token");
    localStorage.removeItem("token");

    navigate("/login");
  }

  async function startLearning(child) {
    setError("");

    if (!selectedClassId || !selectedSubject || !selectedUnit || !selectedTopic) {
      setError("Please select a class, subject, unit and topic first.");
      return;
    }

    setStartingChildId(child.id);

    const curriculumSelection = {
      class_id: selectedClassId,
      class_label: classes.find(item => item.class_id === selectedClassId)?.label || selectedClassId,
      subject_id: selectedSubject.id,
      subject_label: selectedSubject.label,
      unit_id: selectedUnit.id,
unit_title: selectedUnit.title || selectedUnit.label,
      topic_name: selectedTopic,
      learning_outcomes: selectedUnit.outcomes || [],
      suggested_activities: selectedUnit.activities || []
    };

    sessionStorage.setItem(
      "active_curriculum_selection",
      JSON.stringify(curriculumSelection)
    );

    // Request fullscreen directly from the Start Class click.
    if (!document.fullscreenElement) {
      try {
        await document.documentElement.requestFullscreen();
      } catch (fullscreenError) {
        console.log(
          "Fullscreen could not be activated:",
          fullscreenError
        );
      }
    }

    try {
      const response = await fetch(
        `${API}/api/sessions/start/${child.id}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
          }
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.detail || "Unable to start the teaching session."
        );
      }

      sessionStorage.setItem(
        "active_child",
        JSON.stringify(data.child)
      );

      sessionStorage.setItem(
        "active_session",
        JSON.stringify(data.session)
      );

      sessionStorage.setItem("classroom_active", "true");
      sessionStorage.setItem("class_start_authorized", "true");

      navigate("/classroom", {
        replace: true,
        state: {
          child: data.child,
          session: data.session,
          resumed: data.resumed
        }
      });

    } catch (err) {
      setError(err.message);

      // If starting the session fails, leave fullscreen.
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

    } finally {
      setStartingChildId(null);
    }
  }

  function getChildProgress(child) {
    const key = `classmate_progress_${child.id || child.name}`;

    try {
      return JSON.parse(localStorage.getItem(key)) || null;
    } catch {
      return null;
    }
  }

  const parent = (() => { try { return JSON.parse(localStorage.getItem("parent") || "{}"); } catch { return {}; } })();

  return (
    <div className="cm-dashboard">
      <aside className="cm-sidebar">
        <div className="cm-side-brand"><span>✿</span><div>classmate<small>AI LEARNING SPACE</small></div></div>
        <div className="cm-side-label">PARENT SPACE</div>
        <div className="cm-side-link active"><span>▦</span> Overview</div>
        <div className="cm-side-link"><span>♧</span> Child profiles</div>
        <div className="cm-side-link"><span>✧</span> Learning progress</div>
        <div className="cm-sidebar-bottom"><div className="cm-help-card"><span>💡</span><b>Little tip</b><p>Short, happy learning sessions help children build confidence.</p></div><button className="cm-logout" onClick={logout}>↪ <span>Sign out</span></button></div>
      </aside>
      <main className="cm-dashboard-main">
        <header className="cm-dash-top"><div><span className="cm-breadcrumb">PARENT SPACE <b>/</b> OVERVIEW</span><p>Welcome{parent.name ? `, ${parent.name}` : ' back'} 👋</p></div><div className="cm-parent-avatar">{(parent.name || 'P').charAt(0).toUpperCase()}</div></header>
        <section className="cm-dash-welcome"><div><span className="cm-kicker">YOUR FAMILY LEARNING SPACE</span><h1>Small steps.<br/><em>Wonderful progress.</em></h1><p>Everything your little learner needs for today's adventure.</p><button className="cm-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Close form' : '+ Add a child profile'}</button></div><div className="cm-dash-illustration"><div className="cm-dash-sun">☀️</div><div className="cm-dash-rainbow">🌈</div><div className="cm-dash-kid">🧒🏽</div><span className="cm-dash-star star-a">✦</span><span className="cm-dash-star star-b">✧</span></div></section>
        {error && <div className="cm-form-error cm-dash-error" role="alert">{error}</div>}
        {showForm && <form className="cm-add-child" onSubmit={addChild}><div className="cm-add-heading"><div><span className="cm-kicker">NEW LEARNER</span><h2>Create a child profile</h2></div><span>🌱</span></div><div className="cm-add-fields"><label>Child's name<input type="text" placeholder="Enter child's name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></label><label>Age<input type="number" min="2" max="8" value={form.age} onChange={e=>setForm({...form,age:e.target.value})} required/></label><label>Language<select value={form.language} onChange={e=>setForm({...form,language:e.target.value})}><option>English</option><option>Kannada</option><option>Hindi</option></select></label><label>Learning level<select value={form.learning_level} onChange={e=>setForm({...form,learning_level:e.target.value})}><option>Beginner</option><option>Intermediate</option><option>Advanced</option></select></label></div><button className="cm-primary" type="submit">Save child profile →</button></form>}
        <section className="cm-add-child" style={{marginTop: "28px"}}>
          <div className="cm-add-heading">
            <div>
              <span className="cm-kicker">TODAY'S LEARNING PLAN</span>
              <h2>Choose today's lesson</h2>
              <p>Select what your child's teacher should teach today.</p>
            </div>
            <span>📚</span>
          </div>

          {curriculumLoading ? (
            <p>Loading curriculum...</p>
          ) : (
            <div className="cm-add-fields">
              <label>
                Class
                <select
                  value={selectedClassId}
                  onChange={event => setSelectedClassId(event.target.value)}
                >
                  {classes.map(item => (
                    <option key={item.class_id} value={item.class_id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Subject
                <select
                  value={selectedSubjectId}
                  onChange={event => setSelectedSubjectId(event.target.value)}
                >
                  {subjects.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Unit
                <select
                  value={selectedUnitId}
                  onChange={event => setSelectedUnitId(event.target.value)}
                >
                  {availableUnits.map(item => (
                    <option key={item.id} value={item.id}>
                      {item.title || item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Today's topic
                <select
                  value={selectedTopic}
                  onChange={event => setSelectedTopic(event.target.value)}
                >
                  {availableTopics.map((topic, index) => (
                    <option key={index} value={topic}>
                      {topic}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )}

          {selectedUnit && (
            <div style={{marginTop: "16px"}}>
              <b>Learning goals for this unit:</b>
              <ul>
                {(selectedUnit.outcomes || []).map((outcome, index) => (
                  <li key={index}>{outcome}</li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="cm-children-section"><div className="cm-section-title"><div><span className="cm-kicker">YOUR LITTLE LEARNERS</span><h2>Child profiles</h2><p>Choose a learner to begin their class.</p></div><span className="cm-count-pill">{children.length} {children.length === 1 ? 'learner' : 'learners'}</span></div>
          {loading ? <div className="cm-empty"><span>⏳</span><h3>Loading your family space…</h3></div> : children.length === 0 ? <div className="cm-empty"><span>🧸</span><h3>Your learning story starts here</h3><p>Add your child's profile to create their own learning journey.</p><button className="cm-primary" onClick={() => setShowForm(true)}>+ Add first child</button></div> : <div className="cm-child-grid">{children.map((child,index)=>{const progress=getChildProgress(child);const isStarting=startingChildId===child.id;return <article className={`cm-child-card cm-child-${index%4}`} key={child.id}><div className="cm-child-card-top"><div className="cm-child-avatar">{['🧒🏽','👧🏻','👦🏾','👧🏽'][index%4]}</div><span className="cm-level-tag">{child.learning_level}</span></div><h3>{child.name}</h3><p className="cm-child-meta">{child.age} years old <span>·</span> {child.language}</p><div className="cm-progress-box"><div className="cm-progress-heading"><b>Learning progress</b><span>✧</span></div>{progress ? <><div className="cm-progress-track"><span style={{width:`${Math.max(0,Math.min(100,Number(progress.percentage)||0))}%`}}/></div><div className="cm-progress-stats"><span>{progress.completed || 0}/{progress.total || 0} activities</span><strong>{progress.percentage || 0}%</strong></div><small>{progress.answers || 0} answers · {progress.correct || 0} correct</small></> : <p className="cm-no-progress">A fresh start! Progress will appear after the first class.</p>}</div><button className="cm-start-class" disabled={startingChildId!==null} onClick={()=>startLearning(child)}>{isStarting?'Preparing class…':'Start learning'} <span>→</span></button></article>})}</div>}
        </section>
        <footer className="cm-dash-footer">Made for curious minds <span>✿</span> ClassMate AI</footer>
      </main>
    </div>
  );
}

export default Dashboard;
