import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { API } from "../config";

const characters = {
  uppercase: "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""),
  lowercase: "abcdefghijklmnopqrstuvwxyz".split(""),
  numbers: "0123456789".split("")
};

const CANVAS_WIDTH = 1000;
const CANVAS_HEIGHT = 520;

export default function WritingPractice() {
  const canvasRef = useRef(null);
  const drawing = useRef(false);

  const navigate = useNavigate();

  const child = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("active_child") || "{}"
      );
    } catch {
      return {};
    }
  })();

  const [category, setCategory] = useState("uppercase");
  const [letter, setLetter] = useState("A");
  const [mode, setMode] = useState("trace");

  const [hasDrawn, setHasDrawn] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [completed, setCompleted] = useState([]);
  const [speaking, setSpeaking] = useState(false);

  const [testIndex, setTestIndex] = useState(0);
  const [testResults, setTestResults] = useState([]);
  const [submitted, setSubmitted] = useState(false);

  const childId = child.id || child.name || "learner";

  const storageKey = `classmate_writing_${childId}`;
  const testStorageKey = `classmate_writing_tests_${childId}`;

  const availableCharacters = characters[category];

  const testQuestions = [
    { character: "A", prompt: "Write the capital letter A." },
    { character: "B", prompt: "Write the capital letter B." },
    { character: "C", prompt: "Write the capital letter C." },
    { character: "D", prompt: "Write the capital letter D." },
    { character: "E", prompt: "Write the capital letter E." }
  ];

  const currentTest = testQuestions[testIndex];

  useEffect(() => {
    try {
      setCompleted(
        JSON.parse(localStorage.getItem(storageKey) || "[]")
      );

      setTestResults(
        JSON.parse(localStorage.getItem(testStorageKey) || "[]")
      );
    } catch {
      setCompleted([]);
      setTestResults([]);
    }
  }, [storageKey, testStorageKey]);

  function drawGuide() {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    const displayCharacter =
      mode === "test" ? currentTest.character : letter;

    if (mode === "trace") {
      // Large dotted tracing letter
      ctx.save();

      ctx.font = "bold 390px Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      ctx.lineWidth = 9;
      ctx.setLineDash([12, 14]);
      ctx.strokeStyle = "#b7a1e8";

      ctx.strokeText(
        displayCharacter,
        CANVAS_WIDTH / 2,
        CANVAS_HEIGHT / 2
      );

      ctx.restore();
    }

    // Writing lines
    ctx.save();

    ctx.strokeStyle = "#e5e0f0";
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 10]);

    ctx.beginPath();
    ctx.moveTo(70, 420);
    ctx.lineTo(CANVAS_WIDTH - 70, 420);
    ctx.stroke();

    ctx.restore();
  }

  useEffect(() => {
    drawGuide();
    setHasDrawn(false);
    setSubmitted(false);
    setFeedback("");
  }, [letter, mode, testIndex]);

  function selectCategory(value) {
    setCategory(value);
    setLetter(characters[value][0]);
  }

  function getPosition(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x: (event.clientX - rect.left) *
        (CANVAS_WIDTH / rect.width),

      y: (event.clientY - rect.top) *
        (CANVAS_HEIGHT / rect.height)
    };
  }

  function startDrawing(event) {
    if (submitted) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const position = getPosition(event);

    drawing.current = true;

    canvas.setPointerCapture(event.pointerId);

    ctx.beginPath();
    ctx.moveTo(position.x, position.y);

    ctx.lineWidth = 11;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#744bd1";

    setHasDrawn(true);
    setFeedback("");
  }

  function draw(event) {
    if (!drawing.current) return;

    const ctx = canvasRef.current.getContext("2d");
    const position = getPosition(event);

    ctx.lineTo(position.x, position.y);
    ctx.stroke();
  }

  function stopDrawing() {
    drawing.current = false;
  }

  function clearCanvas() {
    drawing.current = false;

    drawGuide();

    setHasDrawn(false);
    setSubmitted(false);
    setFeedback("");
  }

  async function speakTeacher(message) {
    try {
      setSpeaking(true);

      const response = await fetch(
        `${API}/api/voice/speak`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ text: message })
        }
      );

      if (!response.ok) {
        throw new Error("Timbre request failed");
      }

      const blob = await response.blob();
      const audioUrl = URL.createObjectURL(blob);
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeaking(false);
      };

      audio.onerror = () => {
        URL.revokeObjectURL(audioUrl);
        setSpeaking(false);
      };

      await audio.play();

    } catch (error) {
      console.error("Writing teacher voice error:", error);
      setSpeaking(false);
    }
  }

  function saveWritingProgress(character) {
    const updated = [
      ...new Set([...completed, character])
    ];

    setCompleted(updated);

    localStorage.setItem(
      storageKey,
      JSON.stringify(updated)
    );

    const progressKey =
      `classmate_progress_${childId}`;

    try {
      const existing = JSON.parse(
        localStorage.getItem(progressKey) || "{}"
      );

      localStorage.setItem(
        progressKey,
        JSON.stringify({
          ...existing,
          writingPractices: updated,
          writingPracticeCount: updated.length,
          lastWritingPractice: character
        })
      );
    } catch (error) {
      console.error("Could not update writing progress:", error);
    }
  }

  function finishPractice() {
    if (!hasDrawn) {
      setFeedback("Try writing the character first! 😊");

      speakTeacher(
        "Come on, little learner! Let's write the letter first."
      );

      return;
    }

    saveWritingProgress(letter);

    const message =
      `Wonderful effort! You practised ${letter}. ` +
      "Keep practising. You are doing a great job!";

    setFeedback(message);
    speakTeacher(message);
  }

  function submitTest() {
    if (!hasDrawn) {
      setFeedback("Write your answer before submitting! 😊");

      speakTeacher(
        "Please write your answer on the writing board first."
      );

      return;
    }

    const attempt = {
      question: currentTest.prompt,
      character: currentTest.character,
      date: new Date().toLocaleString(),
      submitted: true
    };

    const updatedResults = [
      ...testResults,
      attempt
    ];

    setTestResults(updatedResults);

    localStorage.setItem(
      testStorageKey,
      JSON.stringify(updatedResults)
    );

    setSubmitted(true);

    const message =
      `Well done! You have written your answer for ` +
      `${currentTest.character}. Great effort!`;

    setFeedback(message);
    speakTeacher(message);
  }

  function nextCharacter() {
    const currentIndex = availableCharacters.indexOf(letter);

    const nextIndex =
      (currentIndex + 1) % availableCharacters.length;

    setLetter(availableCharacters[nextIndex]);
  }

  function nextTestQuestion() {
    if (testIndex < testQuestions.length - 1) {
      setTestIndex(testIndex + 1);
    } else {
      setFeedback(
        "Wonderful! You completed all the writing questions! 🌟"
      );

      speakTeacher(
        "Congratulations! You completed your writing test."
      );
    }
  }

  return (
    <main
      className="writing-page"
      style={{
        minHeight: "100vh",
        padding: "20px",
        background: "#f5f0ff",
        boxSizing: "border-box"
      }}
    >

      <header
        className="writing-header"
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px"
        }}
      >
        <h2>✏️ ClassMate AI Writing Board</h2>

        <button onClick={() => navigate("/classroom")}>
          Back to Classroom
        </button>
      </header>

      <section
        className="writing-card"
        style={{
          maxWidth: "1250px",
          margin: "20px auto",
          padding: "25px",
          background: "#ffffff",
          borderRadius: "22px",
          textAlign: "center",
          boxShadow: "0 8px 30px rgba(80,50,120,0.10)"
        }}
      >

        <div style={{ fontSize: "55px" }}>👩‍🏫</div>

        <h1>My Digital Writing Board</h1>

        <p>
          Hello {child.name || "little learner"}!
          Let's learn to write.
        </p>

        {/* CATEGORY SELECTION */}

        <h3>Choose What You Want to Learn</h3>

        <div className="writing-modes">

          <button
            className={category === "uppercase" ? "selected" : ""}
            onClick={() => selectCategory("uppercase")}
          >
            ABC Capital Letters
          </button>

          <button
            className={category === "lowercase" ? "selected" : ""}
            onClick={() => selectCategory("lowercase")}
          >
            abc Small Letters
          </button>

          <button
            className={category === "numbers" ? "selected" : ""}
            onClick={() => selectCategory("numbers")}
          >
            🔢 Numbers
          </button>

        </div>

        {/* CHARACTER SELECTION */}

        <h3>Choose Your Character</h3>

        <div
          className="writing-letters"
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: "8px"
          }}
        >
          {availableCharacters.map(item => (
            <button
              key={item}
              className={letter === item ? "active-letter" : ""}
              onClick={() => {
                setLetter(item);
                setMode("trace");
              }}
            >
              {item}
            </button>
          ))}
        </div>

        {/* MODES */}

        <h3>Choose Writing Activity</h3>

        <div
          className="writing-modes"
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >

          <button
            className={mode === "trace" ? "selected" : ""}
            onClick={() => setMode("trace")}
          >
            ✏️ Trace the Letter
          </button>

          <button
            className={mode === "free" ? "selected" : ""}
            onClick={() => setMode("free")}
          >
            📝 Free Writing
          </button>

          <button
            className={mode === "test" ? "selected" : ""}
            onClick={() => setMode("test")}
          >
            📝 Written Test
          </button>

        </div>

        {/* ACTIVITY INSTRUCTIONS */}

        {mode === "trace" && (
          <>
            <h2>Trace the Letter {letter}</h2>

            <p>
              Follow the dotted lines using your finger or mouse.
            </p>
          </>
        )}

        {mode === "free" && (
          <>
            <h2>Write {letter} Yourself</h2>

            <p>
              Look at the letter and try writing it without tracing.
            </p>
          </>
        )}

        {mode === "test" && (
          <>
            <h2>🌟 Your Writing Test</h2>

            <h3>
              Question {testIndex + 1} of {testQuestions.length}
            </h3>

            <div
              style={{
                padding: "20px",
                background: "#f0eaff",
                borderRadius: "15px",
                fontSize: "25px",
                fontWeight: "bold",
                color: "#7042c8"
              }}
            >
              {currentTest.prompt}
            </div>

            <p>
              Write your answer in the answer sheet below.
            </p>
          </>
        )}

        {/* DIGITAL WRITING BOARD */}

        <div
          className="writing-canvas-container"
          style={{
            width: "100%",
            margin: "25px auto",
            border: "4px solid #cbb7f5",
            borderRadius: "18px",
            overflow: "hidden",
            background: "#ffffff"
          }}
        >

          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            onPointerDown={startDrawing}
            onPointerMove={draw}
            onPointerUp={stopDrawing}
            onPointerCancel={stopDrawing}
            onPointerLeave={stopDrawing}
            style={{
              display: "block",
              width: "100%",
              height: "auto",
              touchAction: "none",
              cursor: "crosshair"
            }}
          />

        </div>

        {/* BUTTONS */}

        <div
          className="writing-actions"
          style={{
            display: "flex",
            justifyContent: "center",
            flexWrap: "wrap",
            gap: "12px"
          }}
        >

          <button onClick={clearCanvas}>
            🧹 Erase and Try Again
          </button>

          {mode === "test" ? (
            <>
              {!submitted ? (
                <button onClick={submitTest}>
                  ⭐ Submit Answer
                </button>
              ) : (
                <button onClick={nextTestQuestion}>
                  ➡️ Next Question
                </button>
              )}
            </>
          ) : (
            <>
              <button onClick={finishPractice}>
                ⭐ Finish Practice
              </button>

              <button onClick={nextCharacter}>
                ➡️ Next Character
              </button>
            </>
          )}

        </div>

        {/* FEEDBACK */}

        {feedback && (
          <div
            className="writing-feedback"
            style={{
              margin: "20px 0",
              padding: "18px",
              borderRadius: "12px",
              background: "#e8f8ed",
              color: "#166534",
              fontSize: "18px"
            }}
          >
            {feedback}
          </div>
        )}

        {/* PROGRESS */}

        <div className="writing-progress">

          <h3>🏆 Your Writing Progress</h3>

          <p>
            Characters practised: {completed.length} / 62
          </p>

          <p>
            Numbers practised: {
              completed.filter(item =>
                characters.numbers.includes(item)
              ).length
            } / 10
          </p>

          <p>
            Letters practised: {
              completed.filter(item =>
                /^[A-Za-z]$/.test(item)
              ).length
            } / 52
          </p>

          <p>
            Written test answers submitted: {testResults.length}
          </p>

        </div>

        <p className="writing-tip">
          Teacher's tip: Start at the top and write slowly.
          You can do it! 🌈
        </p>

        {speaking && (
          <p>🔊 Your teacher is speaking...</p>
        )}

      </section>
    </main>
  );
}
