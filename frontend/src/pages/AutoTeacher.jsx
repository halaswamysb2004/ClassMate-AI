import { useEffect, useRef, useState } from "react";
import usePrisma from "../hooks/usePrisma";

const API = "http://localhost:8000";
const WRITING_PASS_SCORE = 65;

const CURRICULUM = [
  { id: "greeting", title: "Greeting and Warm-up" },
  { id: "alphabet", title: "Alphabet Learning" },
  { id: "numbers", title: "Number Learning" },
  { id: "colours", title: "Colour Learning" },
  { id: "animals", title: "Animal Learning" },
  { id: "games", title: "Educational Games" },
  { id: "stories", title: "Story Time" },
  { id: "knowledge", title: "General Knowledge" },
  { id: "writing", title: "Writing Practice" },
  { id: "quiz", title: "Knowledge Quiz" },
  { id: "assessment", title: "Final Assessment" },
  { id: "goodbye", title: "Appreciation and Goodbye" }
];

function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token")
  );
}

function getSession() {
  try {
    return JSON.parse(
      sessionStorage.getItem("active_session") || "null"
    );
  } catch {
    return null;
  }
}

export default function AutoTeacher({ child }) {
  const [lesson, setLesson] = useState(null);
  const [step, setStep] = useState(0);
  const [started, setStarted] = useState(false);
  const [finished, setFinished] = useState(false);

  const [status, setStatus] = useState(
    "Waiting for parent to start the class."
  );

  const [transcript, setTranscript] = useState("");
  const [reply, setReply] = useState("");
  const [attempts, setAttempts] = useState(0);
  const [answers, setAnswers] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [completed, setCompleted] = useState([]);
  const [topicsToReview, setTopicsToReview] = useState([]);

  const [muted, setMuted] = useState(false);
  const [writingDone, setWritingDone] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);

  // Writing assessment states
  const [writingScore, setWritingScore] = useState(null);
  const [writingFeedback, setWritingFeedback] = useState("");
  const [checkingWriting, setCheckingWriting] = useState(false);

  // Separate canvases prevent the dotted guide
  // from affecting the child's writing score.
  const guideCanvasRef = useRef(null);
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const writingTimerRef = useRef(null);
  const stepRef = useRef(0);
  const startedRef = useRef(false);
  const initializingRef = useRef(false);
  const mutedRef = useRef(false);
  const processingRef = useRef(false);

  const attemptsRef = useRef(0);
  const completedRef = useRef([]);
  const answersRef = useRef(0);
  const correctRef = useRef(0);
  const historyRef = useRef([]);

  const sessionRef = useRef(getSession());

  const audioRef = useRef(null);
  const audioUrlRef = useRef(null);
  const transitionRef = useRef(null);

  // Read the lesson selected by the parent on the dashboard.
  const curriculumSelection = (() => {
    try {
      return JSON.parse(
        sessionStorage.getItem("active_curriculum_selection") || "null"
      );
    } catch {
      return null;
    }
  })();

  // Keep a separate cached lesson for each child and selected topic.
  const lessonKey = [
    "classmate_ai_lesson",
    child?.id || "child",
    curriculumSelection?.class_id || "default",
    curriculumSelection?.subject_id || "default",
    curriculumSelection?.unit_id || "default",
    curriculumSelection?.topic_name || "default"
  ].join("_");

  const writingKey =
    `classmate_writing_${child?.id || "child"}`;

  const currentStage = lesson?.stages?.[step];

  const isWritingStage =
    currentStage?.stage_id === "writing";

  const isAssessmentStage =
    currentStage?.stage_id === "assessment";

  // Final assessment is a separate spoken question-and-answer test.
  const isWritingActivity = isWritingStage;

  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  function updateCompleted(value) {
    completedRef.current = value;
    setCompleted(value);
  }

  function updateAnswers(value) {
    answersRef.current = value;
    setAnswers(value);
  }

  function updateCorrect(value) {
    correctRef.current = value;
    setCorrect(value);
  }

  function updateAttempts(value) {
    attemptsRef.current = value;
    setAttempts(value);
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current.onerror = null;
      audioRef.current = null;
    }

    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
  }

  // Gnani Timbre voice.
  async function speak(message, callback) {
    if (!message) {
      callback?.();
      return;
    }

    if (mutedRef.current) {
      callback?.();
      return;
    }

    stopAudio();

    setStatus("🔊 Your teacher is speaking...");

    try {
      const response = await fetch(
        `${API}/api/voice/speak`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: message
          })
        }
      );

      if (!response.ok) {
        throw new Error("Timbre voice request failed.");
      }

      const blob = await response.blob();

      if (!blob.size) {
        throw new Error("Empty audio response.");
      }

      if (mutedRef.current) {
        callback?.();
        return;
      }

      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;

      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        if (audioRef.current !== audio) return;

        audioRef.current = null;

        URL.revokeObjectURL(url);
        audioUrlRef.current = null;

        callback?.();
      };

      audio.onerror = () => {
        if (audioRef.current !== audio) return;

        audioRef.current = null;

        URL.revokeObjectURL(url);
        audioUrlRef.current = null;

        setStatus("Teacher audio could not be played.");
        callback?.();
      };

      await audio.play();

    } catch (error) {
      console.error("[TIMBRE ERROR]", error);

      setStatus("Teacher voice unavailable. Please try again.");

      callback?.();
    }
  }

  // Gnani Prisma microphone.
  const {
    start: startPrisma,
    pause: pausePrisma,
    stop: stopPrisma,
    listening
  } = usePrisma(handleTranscript, setStatus);

  function startListening() {
    if (
      startedRef.current &&
      !mutedRef.current
    ) {
      startPrisma();
    }
  }

  // Save progress to the backend.
  async function saveCheckpoint(index, message = "") {
    const session = sessionRef.current;
    const token = getToken();

    if (!session?.id || !token) {
      setStatus("Session information is missing.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(
        `${API}/api/sessions/${session.id}/checkpoint`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({
            current_activity_index: index,
            current_topic:
              CURRICULUM[index]?.id || "completed",
            completed_activities: completedRef.current,
            attempts: attemptsRef.current,
            answers: answersRef.current,
            correct_answers: correctRef.current,
            topics_to_review: topicsToReview,
            last_teacher_message:
              String(message).slice(0, 1000)
          })
        }
      );

      if (!response.ok) {
        throw new Error("Unable to save session progress.");
      }

      const saved = await response.json();

      console.log("[SESSION SAVED]", saved);

    } catch (error) {
      console.error("[CHECKPOINT ERROR]", error);

      setStatus(
        "Unable to save progress. Check your connection."
      );

    } finally {
      setSaving(false);
    }
  }

  // Generate or restore the lesson without delaying class startup.
  async function createLesson() {
    const cached = sessionStorage.getItem(lessonKey);

    if (cached) {
      try {
        const savedLesson = JSON.parse(cached);

        if (
          savedLesson?.stages?.length === 12 &&
          savedLesson?.lesson_source === "ai" &&
          savedLesson?.curriculum_topic ===
            (curriculumSelection?.topic_name || null)
        ) {
          console.log("[LESSON CACHE] Restoring AI-generated lesson.");
          return savedLesson;
        }
      } catch {
        sessionStorage.removeItem(lessonKey);
      }
    }

    // Start with an instant local lesson.
    // Gemini prepares the personalized lesson in the background.
    const defaultStages = [
      {
        stage_id: "greeting",
        title: "Greeting and Warm-up",
        learning_objective: "Make the child comfortable and ready to learn.",
        teaching_method: "Friendly conversation",
        teacher_instruction: "Hello! Welcome to our classroom! I am so happy to see you today. We are going to learn and have lots of fun together!",
        visual: "🌈 A bright, colourful classroom",
        question: "Let's begin our learning adventure!",
        expected_answer: "Ready to learn",
        activity_type: "greeting"
      },
      {
        stage_id: "alphabet",
        title: "Alphabet Learning",
        learning_objective: "Learn letters and their sounds.",
        teaching_method: "Examples and sounds",
        teacher_instruction: "Today we will learn the alphabet. This is the letter A. A makes the sound ah. A is for Apple!",
        visual: "🍎 A red apple",
        question: "Can you tell me what A stands for?",
        expected_answer: "Apple",
        activity_type: "conversation"
      },
      {
        stage_id: "numbers",
        title: "Number Learning",
        learning_objective: "Learn to count numbers.",
        teaching_method: "Counting objects",
        teacher_instruction: "Let's count together! One, two, three. Counting is fun!",
        visual: "🔢 Three colourful balls",
        question: "How many balls are there if we have one, two and three?",
        expected_answer: "Three",
        activity_type: "conversation"
      },
      {
        stage_id: "colours",
        title: "Colour Learning",
        learning_objective: "Identify common colours.",
        teaching_method: "Everyday examples",
        teacher_instruction: "Look at the beautiful colours around us. Apples can be red, leaves can be green and the sky can be blue.",
        visual: "🎨 Colourful objects",
        question: "What colour is a ripe tomato?",
        expected_answer: "Red",
        activity_type: "conversation"
      },
      {
        stage_id: "animals",
        title: "Animal Learning",
        learning_objective: "Recognize animals and their sounds.",
        teaching_method: "Animal sounds",
        teacher_instruction: "Let's meet some animals! A cow says moo, a dog says bow-wow and a cat says meow!",
        visual: "🐮🐶🐱 Farm animals",
        question: "Which animal says moo?",
        expected_answer: "Cow",
        activity_type: "conversation"
      },
      {
        stage_id: "games",
        title: "Educational Games",
        learning_objective: "Practise learning through games.",
        teaching_method: "Guessing game",
        teacher_instruction: "Let's play a guessing game! I am thinking of a fruit. It is yellow and monkeys love it!",
        visual: "🍌 A yellow banana",
        question: "Can you guess the fruit?",
        expected_answer: "Banana",
        activity_type: "conversation"
      },
      {
        stage_id: "stories",
        title: "Story Time",
        learning_objective: "Learn through a short story.",
        teaching_method: "Educational story",
        teacher_instruction: "Once upon a time, a little rabbit found three carrots. He shared them with his friends. Sharing makes everyone happy!",
        visual: "🐰 A little rabbit",
        question: "How many carrots did the rabbit find?",
        expected_answer: "Three",
        activity_type: "conversation"
      },
      {
        stage_id: "knowledge",
        title: "General Knowledge",
        learning_objective: "Learn simple facts about the world.",
        teaching_method: "Question and answer",
        teacher_instruction: "Our world is wonderful! The Sun gives us light and warmth during the day.",
        visual: "☀️ The bright Sun",
        question: "What shines brightly in the sky during the day?",
        expected_answer: "Sun",
        activity_type: "conversation"
      },
      {
        stage_id: "writing",
        title: "Writing Practice",
        learning_objective: "Practise writing the letter A.",
        teaching_method: "Tracing",
        teacher_instruction: "Let's practise writing the letter A. Follow the dotted guide carefully!",
        visual: "✏️ Writing practice",
        question: "Can you trace the letter A?",
        expected_answer: "A",
        activity_type: "writing"
      },
      {
        stage_id: "quiz",
        title: "Knowledge Quiz",
        learning_objective: "Review concepts learned today.",
        teaching_method: "Quick quiz",
        teacher_instruction: "Now let's see what you remember. You have learned so many wonderful things!",
        visual: "❓ A fun quiz",
        question: "What is A for?",
        expected_answer: "Apple",
        activity_type: "conversation"
      },
      {
        stage_id: "assessment",
        title: "Final Assessment",
        learning_objective: "Check writing skills.",
        teaching_method: "Independent writing",
        teacher_instruction: "It is time for your final writing test. Write the letter A independently. You can do it!",
        visual: "📝 Final writing test",
        question: "Write the letter A.",
        expected_answer: "A",
        activity_type: "writing"
      },
      {
        stage_id: "goodbye",
        title: "Appreciation and Goodbye",
        learning_objective: "Celebrate the child's effort.",
        teaching_method: "Positive encouragement",
        teacher_instruction: "You did a wonderful job today! I am very proud of you. Keep learning and smiling. See you next time!",
        visual: "🏆 A celebration",
        question: "Goodbye, little learner!",
        expected_answer: "Goodbye",
        activity_type: "goodbye"
      }
    ];

    const instantLesson = {
      lesson_title: "Personalized Learning Adventure",
      child_name: child?.name || "Little Learner",
      language: child?.language || "English",
      stages: defaultStages
    };

    // Do not cache the generic fallback as a completed AI lesson.
    // Only successfully generated lessons should be reused.

    // Generate the actual lesson before starting the classroom.
    // This ensures the child is taught the selected curriculum topic.
    try {
      setStatus("Preparing your personalized lesson...");

      const response = await fetch(`${API}/api/teacher/plan`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          child_name: child?.name || "Little Learner",
          child_age: Number(child?.age || 5),
          language: child?.language || "English",
          learning_level: child?.learning_level || "Beginner",
          previous_topics: [],
          class_id: curriculumSelection?.class_id || null,
          subject_id: curriculumSelection?.subject_id || null,
          unit_id: curriculumSelection?.unit_id || null,
          topic_name: curriculumSelection?.topic_name || null
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Lesson generation failed: ${errorText}`);
      }

      const data = await response.json();
      const generated = data.lesson;

      if (
        !generated?.stages ||
        generated.stages.length !== 12 ||
        !generated.stages.every(
          (stage, index) =>
            stage.stage_id === CURRICULUM[index].id
        )
      ) {
        throw new Error("The AI returned an invalid 12-stage lesson.");
      }

      const lessonToCache = {
        ...generated,
        lesson_source: "ai",
        curriculum_topic: curriculumSelection?.topic_name || null
      };

      sessionStorage.setItem(
        lessonKey,
        JSON.stringify(lessonToCache)
      );

      console.log("[LESSON READY] AI-generated curriculum lesson loaded.");

      return lessonToCache;

    } catch (error) {
      console.error("[LESSON GENERATION ERROR]", error);

      setStatus(
        "Using the classroom backup lesson. Please check the AI connection."
      );

      // Keep the existing fallback so the classroom can still open.
      return instantLesson;
    }
  }

  // Restore saved session progress.
  function restoreProgress(session) {
    const data = session?.session_data || {};

    const index = Math.min(
      Math.max(
        Number(session?.current_activity_index || 0),
        0
      ),
      11
    );

    stepRef.current = index;
    setStep(index);

    updateCompleted(
      data.completed_activities || []
    );

    updateAnswers(Number(data.answers || 0));
    updateCorrect(Number(data.correct_answers || 0));
    updateAttempts(Number(data.attempts || 0));

    setTopicsToReview(
      data.topics_to_review || []
    );

    return index;
  }

  // Start the class.
  async function initializeClass() {
    if (
      initializingRef.current ||
      startedRef.current
    ) {
      return;
    }

    initializingRef.current = true;

    try {
      const session = getSession();

      sessionRef.current = session;

      if (!session?.id) {
        throw new Error(
          "No active session. Return to the dashboard."
        );
      }

      const generated = await createLesson();

      setLesson(generated);

      const savedIndex = restoreProgress(session);

      startedRef.current = true;
      setStarted(true);

      setStatus(
        "Your learning adventure is starting!"
      );

      await teachStage(savedIndex, generated);

    } catch (error) {
      console.error(
        "[CLASSROOM INITIALIZATION]",
        error
      );

      setStatus(
        error.message || "Unable to start the classroom."
      );

    } finally {
      initializingRef.current = false;
    }
  }

  // Extract the actual letter or numeral to practise.
  function getWritingTarget(stage) {
    if (stage?.writing_target) {
      const explicit = String(stage.writing_target).trim();
      const match = explicit.match(/[a-zA-Z0-9]/);
      if (match) return match[0].toUpperCase();
    }

    const sources = [
      stage?.teacher_instruction,
      stage?.learning_objective,
      stage?.question
    ].filter(Boolean).join(" ");

    const patterns = [
      /(?:number|numeral|letter)\\s+['"“]?([a-zA-Z0-9])/i,
      /(?:write|trace|practise|practice)\\s+(?:the\\s+)?['"“]?([a-zA-Z0-9])/i
    ];

    for (const pattern of patterns) {
      const match = sources.match(pattern);
      if (match) return match[1].toUpperCase();
    }

    const answer = String(stage?.expected_answer || "").trim();

    if (/^(yes|yeah|yep|okay|ok)$/i.test(answer)) {
      return "1";
    }

    const fallback = answer.match(/[a-zA-Z0-9]/);
    return fallback ? fallback[0].toUpperCase() : "1";
  }

  // Draw the dotted guide on a separate canvas.
  function drawWritingGuide() {
    const canvas = guideCanvasRef.current;

    if (!canvas || !isWritingStage) return;

    const context = canvas.getContext("2d");

    context.clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    context.fillStyle = "#ffffff";

    context.fillRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const target = getWritingTarget(currentStage);

    context.font = "bold 220px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.strokeStyle = "#b9a4e9";
    context.lineWidth = 5;
    context.setLineDash([5, 9]);

    context.strokeText(
      target,
      canvas.width / 2,
      canvas.height / 2
    );

    context.setLineDash([]);
  }

  // Draw the guide after React renders the writing screen.
  useEffect(() => {
    if (isWritingStage) {
      const frame = requestAnimationFrame(
        drawWritingGuide
      );

      return () => cancelAnimationFrame(frame);
    }
  }, [step, lesson]);

  // Start the correct lesson stage.
  async function teachStage(index, lessonData = lesson) {
    if (!lessonData?.stages?.[index]) return;

    pausePrisma();
    stopAudio();
    clearTimeout(writingTimerRef.current);
    clearTimeout(transitionRef.current);

    if (canvasRef.current) {
      canvasRef.current.getContext("2d").clearRect(
        0, 0,
        canvasRef.current.width,
        canvasRef.current.height
      );
    }

    stepRef.current = index;
    setStep(index);
    setTranscript("");
    setReply("");

    processingRef.current = false;
    drawingRef.current = false;

    setWritingDone(false);
    setHasDrawn(false);
    setWritingScore(null);
    setWritingFeedback("");
    setCheckingWriting(false);

    const stage = lessonData.stages[index];

    // Greeting automatically advances without asking the child a question.
    if (stage.stage_id === "greeting") {
      setStatus("Welcome! Starting your learning adventure...");

      const selectedTopic =
        curriculumSelection?.topic_name || "something exciting";

      const greeting =
        `Hello ${child?.name || "little learner"}! ` +
        "Welcome to our classroom! I am so happy to see you. " +
        `Today we are going to learn about ${selectedTopic}. ` +
        "Are you ready for our learning adventure?";

      let advanced = false;

      const advanceToAlphabet = () => {
        if (advanced || !startedRef.current) return;
        advanced = true;
        teachStage(index + 1, lessonData);
      };

      // Start Alphabet only after Greeting audio has finished.
      speak(greeting, advanceToAlphabet);
      return;
    }

    if (stage.stage_id === "writing") {
      const target = getWritingTarget(stage);

      setStatus("✏️ Writing Practice");

      const message =
        `${stage.title}. ${stage.teacher_instruction} ` +
        `Let's practise writing ${target}. ` +
        "Follow the dotted guide and write carefully.";

      speak(message);
      return;
    }

    if (stage.stage_id === "goodbye") {
      speak(
        `${stage.teacher_instruction} You have completed your learning adventure!`,
        () => completeClass()
      );
      return;
    }

    const message =
      `${stage.title}. ${stage.teacher_instruction} ${stage.question}`;

    speak(message, () => {
      startListening();
    });
  }

  // Ask Gemini to evaluate the child's spoken answer.
  async function evaluateChild(words, stage) {
    setStatus("🧠 Your teacher is thinking...");

    const response = await fetch(
      `${API}/api/teacher/evaluate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: words,
          child_age: Number(child?.age || 5),
          activity:
            `${stage.title}. ` +
            `Learning objective: ${stage.learning_objective}. ` +
            `Teaching instruction: ${stage.teacher_instruction}. ` +
            `Question: ${stage.question}. ` +
            `Expected answer: ${stage.expected_answer}.`,
          attempts: attemptsRef.current,
          history: historyRef.current.slice(-4)
        })
      }
    );

    if (!response.ok) {
      throw new Error(
        "Unable to evaluate the response."
      );
    }

    return response.json();
  }

  async function handleTranscript(words) {
    if (
      !words ||
      !startedRef.current ||
      processingRef.current
    ) {
      return;
    }

    processingRef.current = true;

    pausePrisma();

    setTranscript(words);

    const stage =
      lesson?.stages?.[stepRef.current];

    if (!stage) {
      processingRef.current = false;
      return;
    }

    const lower = words.toLowerCase().trim();

    if (
      /^(repeat|again|say again|repeat please)$/i.test(lower)
    ) {
      processingRef.current = false;

      teachStage(stepRef.current);

      return;
    }

    await processAnswer(words, stage);
  }

  // Process the child's answer.
  async function processAnswer(words, stage) {
    try {
      const result = await evaluateChild(
        words,
        stage
      );

      const feedback =
        result.feedback || "Let's try that together!";

      historyRef.current = [
        ...historyRef.current,
        { role: "child", content: words },
        { role: "teacher", content: feedback }
      ].slice(-8);

      setReply(feedback);

      if (
        result.type === "off_topic" ||
        result.type === "question" ||
        result.type === "repeat"
      ) {
        speak(feedback, () => {
          processingRef.current = false;
          startListening();
        });

        return;
      }

      updateAnswers(answersRef.current + 1);

      if (
        result.correct &&
        result.next_action === "advance"
      ) {
        updateCorrect(correctRef.current + 1);
        updateAttempts(0);

        const nextCompleted = [
          ...new Set([
            ...completedRef.current,
            stage.stage_id
          ])
        ];

        updateCompleted(nextCompleted);

        const nextIndex = stepRef.current + 1;

        void saveCheckpoint(nextIndex, feedback);

        speak(feedback, () => {
          transitionRef.current = setTimeout(() => {
            if (nextIndex < 12) {
              teachStage(nextIndex);
            } else {
              completeClass();
            }
          }, 1000);
        });

        return;
      }

      const newAttempts =
        attemptsRef.current + 1;

      updateAttempts(newAttempts);

      if (
        newAttempts >= 3 &&
        !topicsToReview.includes(stage.title)
      ) {
        setTopicsToReview(previous => [
          ...previous,
          stage.title
        ]);
      }

      let teacherMessage = feedback;

      if (result.teaching_method === "new") {
        teacherMessage +=
          " Let's look at it in a different way.";
      }

      void saveCheckpoint(stepRef.current, teacherMessage);

      speak(teacherMessage, () => {
        processingRef.current = false;
        startListening();
      });

    } catch (error) {
      console.error("[ANSWER ERROR]", error);

      const message =
        "Good try, little learner. Let's try once more. " +
        stage.question;

      setReply(message);

      speak(message, () => {
        processingRef.current = false;
        startListening();
      });
    }
  }

  // Convert mouse or touch position to canvas coordinates.
  function getCanvasPosition(event) {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();

    return {
      x:
        (event.clientX - rect.left) *
        (canvas.width / rect.width),

      y:
        (event.clientY - rect.top) *
        (canvas.height / rect.height)
    };
  }

  // Begin writing.
  function startDrawing(event) {
    if (writingDone || checkingWriting) return;

    clearTimeout(writingTimerRef.current);
    const canvas = canvasRef.current;

    if (!canvas) return;

    const context = canvas.getContext("2d");
    const position = getCanvasPosition(event);

    drawingRef.current = true;

    canvas.setPointerCapture(event.pointerId);

    context.beginPath();

    context.moveTo(
      position.x,
      position.y
    );

    context.lineWidth = 10;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#744bd1";

    setHasDrawn(true);
  }

  // Continue drawing.
  function draw(event) {
    if (
      !drawingRef.current ||
      writingDone ||
      checkingWriting
    ) {
      return;
    }

    const context =
      canvasRef.current.getContext("2d");

    const position = getCanvasPosition(event);

    context.lineTo(
      position.x,
      position.y
    );

    context.stroke();
  }

  function stopDrawing() {
    drawingRef.current = false;

    clearTimeout(writingTimerRef.current);

    // Automatically evaluate two seconds after the child stops writing.
    writingTimerRef.current = setTimeout(() => {
      if (!drawingRef.current && hasDrawn && !checkingWriting && !writingDone) {
        finishWriting();
      }
    }, 2000);
  }

  // Clear only the child's drawing.
  function clearWriting() {
    const canvas = canvasRef.current;

    if (!canvas) return;

    canvas.getContext("2d").clearRect(
      0,
      0,
      canvas.width,
      canvas.height
    );

    drawingRef.current = false;

    setHasDrawn(false);
    setWritingDone(false);

    setWritingScore(null);
    setWritingFeedback("");
  }

  // Create a reference letter for comparison.
  function createReferenceCanvas(target) {
    const reference = document.createElement("canvas");

    reference.width = 600;
    reference.height = 300;

    const context = reference.getContext("2d");

    context.font = "bold 220px Arial";
    context.textAlign = "center";
    context.textBaseline = "middle";

    context.lineWidth = 10;
    context.lineJoin = "round";
    context.strokeStyle = "#000000";

    context.strokeText(
      target,
      reference.width / 2,
      reference.height / 2
    );

    return reference;
  }

  // Create a binary pixel mask.
  function getPixelMask(canvas) {
    const context = canvas.getContext("2d");

    const image = context.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const width = 300;
    const height = 150;

    const mask = new Uint8Array(
      width * height
    );

    // Sample every second pixel to reduce processing.
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const pixelIndex =
          ((y * 2) * canvas.width + x * 2) * 4;

        const alpha = image.data[pixelIndex + 3];

        if (alpha > 40) {
          mask[y * width + x] = 1;
        }
      }
    }

    return {
      mask,
      width,
      height
    };
  }

  // Expand pixels slightly to allow small tracing differences.
  function dilateMask(mask, width, height, radius = 5) {
    const expanded = new Uint8Array(
      width * height
    );

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!mask[y * width + x]) continue;

        for (
          let dy = -radius;
          dy <= radius;
          dy++
        ) {
          for (
            let dx = -radius;
            dx <= radius;
            dx++
          ) {
            if (
              dx * dx + dy * dy >
              radius * radius
            ) {
              continue;
            }

            const nx = x + dx;
            const ny = y + dy;

            if (
              nx >= 0 &&
              nx < width &&
              ny >= 0 &&
              ny < height
            ) {
              expanded[ny * width + nx] = 1;
            }
          }
        }
      }
    }

    return expanded;
  }

  // Compare the child's drawing with the target character.
  function calculateWritingAccuracy(target) {
    const userCanvas = canvasRef.current;

    if (!userCanvas) return 0;

    const referenceCanvas =
      createReferenceCanvas(target);

    const userData = getPixelMask(userCanvas);
    const referenceData =
      getPixelMask(referenceCanvas);

    const width = userData.width;
    const height = userData.height;

    const userMask = userData.mask;
    const referenceMask = referenceData.mask;

    const expandedUser = dilateMask(
      userMask,
      width,
      height
    );

    const expandedReference = dilateMask(
      referenceMask,
      width,
      height
    );

    let userPixels = 0;
    let referencePixels = 0;

    let matchedUser = 0;
    let matchedReference = 0;

    for (
      let i = 0;
      i < userMask.length;
      i++
    ) {
      if (userMask[i]) {
        userPixels++;

        if (expandedReference[i]) {
          matchedUser++;
        }
      }

      if (referenceMask[i]) {
        referencePixels++;

        if (expandedUser[i]) {
          matchedReference++;
        }
      }
    }

    if (!userPixels || !referencePixels) {
      return 0;
    }

    const precision =
      matchedUser / userPixels;

    const recall =
      matchedReference / referencePixels;

    const score =
      2 * precision * recall /
      (precision + recall || 1);

    return Math.round(score * 100);
  }

  // Automatically check the child's writing after the child stops drawing.
  async function finishWriting() {
    if (!hasDrawn || checkingWriting || writingDone) return;

    clearTimeout(writingTimerRef.current);
    setCheckingWriting(true);

    const stage = lesson?.stages?.[stepRef.current];

    if (!stage) {
      setCheckingWriting(false);
      return;
    }

    const target = getWritingTarget(stage);
    const score = calculateWritingAccuracy(target);
    const passed = score >= WRITING_PASS_SCORE;
    const isPractice = stage.stage_id === "writing";

    setWritingScore(score);

    let feedback;

    if (score >= 85) {
      feedback =
        "Excellent writing! Your letter looks very similar to the example. Wonderful work!";
    } else if (passed) {
      feedback =
        "Good job! You wrote the letter quite well. Keep practising to make it even better!";
    } else if (isPractice) {
      feedback =
        "Good try! Let's practise again. Watch the dotted letter and trace it carefully.";
    } else {
      feedback =
        "Good try! Let's try that letter once more. Look carefully and write it independently.";
    }

    setWritingFeedback(feedback);

    // Store each writing result locally.
    try {
      const previous = JSON.parse(
        localStorage.getItem(writingKey) || "[]"
      );

      previous.push({
        stage: stage.stage_id,
        target,
        score,
        passed,
        date: new Date().toISOString()
      });

      localStorage.setItem(writingKey, JSON.stringify(previous));
    } catch (error) {
      console.error("[WRITING STORAGE ERROR]", error);
    }

    if (!passed) {
      const newAttempts = attemptsRef.current + 1;
      updateAttempts(newAttempts);

      if (
        newAttempts >= 2 &&
        !topicsToReview.includes(stage.title)
      ) {
        setTopicsToReview(previous => [...previous, stage.title]);
      }

      // Clear only the child's drawing. The Stage 9 dotted guide remains.
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.getContext("2d").clearRect(
          0,
          0,
          canvas.width,
          canvas.height
        );
      }

      drawingRef.current = false;
      setHasDrawn(false);
      setWritingDone(false);

      setStatus(
        isPractice
          ? "✏️ Let's trace the letter again!"
          : "📝 Let's try the final writing test again!"
      );

      void saveCheckpoint(
        stepRef.current,
        `Writing score: ${score}%. Child needs another attempt.`
      );

      // Keep the writing area locked while the teacher gives feedback.
      speak(feedback, () => {
        setCheckingWriting(false);
      });

      return;
    }

    setWritingDone(true);
    setCheckingWriting(false);
    updateAttempts(0);

    setStatus(`Writing checked! Similarity: ${score}%. Moving to the next activity...`);

    // Automatically continue after the teacher praises the child.
    speak(feedback, () => {
      continueAfterWriting(true, score);
    });
  }

  // Move forward after a successful writing check.
  async function continueAfterWriting(automatic = false, scoreOverride = null) {
    if (!automatic && !writingDone) return;

    const stage = lesson?.stages?.[stepRef.current];
    if (!stage) return;

    const nextCompleted = [
      ...new Set([
        ...completedRef.current,
        stage.stage_id
      ])
    ];

    updateCompleted(nextCompleted);
    updateAnswers(answersRef.current + 1);
    updateCorrect(correctRef.current + 1);
    updateAttempts(0);

    const nextIndex = stepRef.current + 1;
    const finalScore = scoreOverride ?? writingScore;

    void saveCheckpoint(
      nextIndex,
      `Completed ${stage.title}. Writing similarity: ${finalScore}%.`
    );

    transitionRef.current = setTimeout(() => {
      if (nextIndex < 12) {
        teachStage(nextIndex);
      } else {
        completeClass();
      }
    }, 700);
  }

  // Skip the current activity and move to the next stage.
  async function goToNextStage() {
    if (!startedRef.current || !lesson?.stages) return;

    const currentIndex = stepRef.current;
    const nextIndex = currentIndex + 1;

    if (nextIndex >= lesson.stages.length) {
      await completeClass();
      return;
    }

    clearTimeout(transitionRef.current);
    clearTimeout(writingTimerRef.current);
    pausePrisma();
    stopAudio();
    processingRef.current = false;
    drawingRef.current = false;

    setStatus("Moving to the next activity...");

    await saveCheckpoint(
      nextIndex,
      `Skipped ${lesson.stages[currentIndex].title} and moved to the next activity.`
    );

    teachStage(nextIndex);
  }

  // Complete the entire class.
  async function completeClass() {
    stopPrisma();
    stopAudio();

    startedRef.current = false;
    processingRef.current = false;

    setStarted(false);
    setFinished(true);

    setStatus(
      "🏆 Learning session completed!"
    );

    const session = sessionRef.current;
    const token = getToken();

    if (session?.id && token) {
      try {
        const response = await fetch(
          `${API}/api/sessions/${session.id}/complete`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            "Session completion could not be saved."
          );
        }

        sessionStorage.removeItem("active_session");
        sessionStorage.removeItem("classroom_active");

      } catch (error) {
        console.error(
          "[COMPLETE ERROR]",
          error
        );

        setStatus(
          "Class finished, but saving completion failed."
        );
      }
    }
  }

  // Pause the class.
  async function pauseClass() {
    startedRef.current = false;
    processingRef.current = false;

    clearTimeout(transitionRef.current);
    clearTimeout(writingTimerRef.current);

    stopPrisma();
    stopAudio();

    setStarted(false);

    setStatus(
      "Saving your learning progress..."
    );

    await saveCheckpoint(stepRef.current);

    const session = sessionRef.current;
    const token = getToken();

    if (session?.id && token) {
      try {
        const response = await fetch(
          `${API}/api/sessions/${session.id}/pause`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        );

        if (!response.ok) {
          throw new Error(
            "Unable to pause the session."
          );
        }

        sessionStorage.removeItem("classroom_active");

        setStatus(
          "Class paused. Your progress has been saved."
        );

      } catch (error) {
        console.error("[PAUSE ERROR]", error);

        setStatus(
          "Unable to save the paused session."
        );
      }
    }
  }

  // Mute or unmute the teacher.
  function toggleMute() {
    const value = !mutedRef.current;

    mutedRef.current = value;
    setMuted(value);

    if (value) {
      stopPrisma();
      stopAudio();

      setStatus("Teacher voice muted.");

    } else if (startedRef.current) {
      speak(
        "I am back. Let's continue learning!",
        startListening
      );
    }
  }

  // Start automatically only after parent authorization.
  useEffect(() => {
    const authorized =
      sessionStorage.getItem(
        "class_start_authorized"
      ) === "true";

    if (authorized) {
      sessionStorage.removeItem(
        "class_start_authorized"
      );

      initializeClass();
    }

    return () => {
      startedRef.current = false;

      clearTimeout(transitionRef.current);
      clearTimeout(writingTimerRef.current);

      stopPrisma();
      stopAudio();
    };
  }, []);

  return (
    <section className="cm-classroom">
      <style>{`
        .cm-classroom{--ink:#292744;--muted:#77748f;--purple:#7962d4;--purple2:#9a83ed;--lav:#f1edff;--mint:#e9f8f1;--peach:#fff1e8;color:var(--ink);font-family:Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;max-width:1180px;margin:24px auto;padding:clamp(14px,3vw,30px);box-sizing:border-box}
        .cm-classroom *{box-sizing:border-box}
        .cm-topbar{display:flex;align-items:center;justify-content:space-between;gap:14px;background:#fff;border:1px solid #eeeaf8;border-radius:22px;padding:15px 20px;box-shadow:0 10px 35px #3d2b7410;margin-bottom:18px}
        .cm-brand{display:flex;align-items:center;gap:12px;font-weight:850;font-size:18px}.cm-brand-icon{width:46px;height:46px;border-radius:15px;background:var(--lav);display:grid;place-items:center;font-size:25px}.cm-child-pill{background:#f7f4ff;border:1px solid #eee8ff;border-radius:999px;padding:10px 15px;font-size:13px;font-weight:750}
        .cm-teacherbar{display:flex;align-items:center;gap:13px;padding:15px 18px;border-radius:18px;background:linear-gradient(105deg,#f0eaff,#fff0f5);margin-bottom:16px}.cm-teacher-avatar{width:48px;height:48px;display:grid;place-items:center;background:#fff;border-radius:16px;font-size:27px;box-shadow:0 5px 15px #7962d422}.cm-teacherbar h2{font-size:16px;margin:0 0 4px;font-weight:850}.cm-teacherbar p{font-size:13px;color:var(--muted);margin:0}.cm-saving{margin-left:auto;font-size:12px;color:var(--purple);font-weight:750}
        .cm-maincard{background:#fff;border:1px solid #eeeaf8;border-radius:28px;padding:clamp(18px,3vw,34px);box-shadow:0 18px 55px #33235d0d;overflow:hidden}
        .cm-stage-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:22px}.cm-stage-kicker{font-size:11px;letter-spacing:.15em;text-transform:uppercase;font-weight:850;color:var(--purple)}.cm-stage-count{font-size:12px;font-weight:750;color:#756c99;background:#f5f1ff;border-radius:999px;padding:9px 13px}
        .cm-stage-title{font-size:clamp(25px,4vw,38px);line-height:1.12;letter-spacing:-.04em;margin:7px 0 0;font-weight:900}.cm-stage-title span{color:var(--purple)}
        .cm-stage-body{position:relative;min-height:300px;border-radius:24px;padding:clamp(20px,4vw,38px);background:radial-gradient(circle at 12% 15%,#fff9eb 0,transparent 35%),linear-gradient(135deg,#fbf9ff,#f5f0ff 60%,#fff3f0);text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:center}
        .cm-visual{font-size:clamp(46px,8vw,76px);line-height:1.2;margin:0 0 12px;filter:drop-shadow(0 8px 9px #6d54a51c)}.cm-objective{color:var(--muted);font-size:14px;margin:0 0 16px;max-width:650px}.cm-question{font-size:clamp(19px,3vw,27px);font-weight:850;line-height:1.35;margin:0 auto 12px;max-width:720px}.cm-attempts{font-size:12px;color:var(--muted);background:#fff9;border-radius:999px;padding:7px 12px}
        .cm-writing{width:100%;max-width:760px;margin:0 auto}.cm-writing h3{font-size:21px;margin:0 0 7px}.cm-writing p{color:var(--muted);font-size:14px;margin:0 0 14px}.cm-classroom .writing-canvas-wrapper{width:min(100%,650px)!important;margin:16px auto!important;border:2px dashed #c9baf5!important;border-radius:20px!important;box-shadow:inset 0 0 0 7px #faf8ff,0 8px 25px #6d54a510}.cm-classroom .writing-result{max-width:650px!important;border:1px solid #e8e0f7}
        .cm-progress-area{margin:22px 0 8px}.cm-progress-label{display:flex;justify-content:space-between;gap:10px;color:var(--muted);font-size:12px;font-weight:750;margin-bottom:9px}.cm-progress-track{height:10px;background:#eeeaf8;border-radius:99px;overflow:hidden}.cm-progress-fill{height:100%;background:linear-gradient(90deg,#8d75e6,#c49cf4);border-radius:99px;transition:width .35s ease}
        .cm-controls{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-top:20px;padding:14px;background:#faf9ff;border:1px solid #efebfa;border-radius:18px}.cm-live{display:flex;align-items:center;gap:8px;font-size:13px;font-weight:800;color:#6556a2}.cm-live-dot{width:9px;height:9px;border-radius:50%;background:#52c69b;box-shadow:0 0 0 4px #52c69b22}.cm-actions{display:flex;gap:9px;flex-wrap:wrap}.cm-btn{border:1px solid #e3ddf3;background:#fff;color:#514a70;border-radius:13px;padding:11px 16px;font:inherit;font-size:13px;font-weight:800;cursor:pointer;transition:.18s}.cm-btn:hover{transform:translateY(-1px);box-shadow:0 6px 15px #3d2b7414}.cm-btn-primary{background:linear-gradient(120deg,#7860d2,#967be7);color:white;border:0;box-shadow:0 8px 18px #7962d433}.cm-btn:disabled{opacity:.55;cursor:not-allowed;transform:none}
        .cm-conversation{margin-top:15px;padding:15px 18px;background:#f8f6ff;border-radius:16px;color:#5c5874;font-size:14px}.cm-conversation p{margin:5px 0}.cm-start,.cm-finished{text-align:center;padding:clamp(35px,7vw,75px) 20px;background:linear-gradient(135deg,#f4efff,#fff5ed);border-radius:24px}.cm-start-icon{font-size:58px;margin-bottom:12px}.cm-start h2,.cm-finished h2{font-size:clamp(26px,4vw,38px);margin:0 0 10px}.cm-start p,.cm-finished p{color:var(--muted);line-height:1.6}.cm-stats{display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin:20px 0}.cm-stat{background:#fff;border:1px solid #eee8fa;border-radius:15px;padding:13px 18px;min-width:125px}.cm-stat strong{display:block;color:var(--purple);font-size:23px}.cm-stat span{font-size:11px;color:var(--muted)}
        @media(max-width:620px){.cm-classroom{margin:8px auto;padding:10px}.cm-topbar{padding:12px;border-radius:17px}.cm-brand{font-size:15px}.cm-brand-icon{width:40px;height:40px}.cm-child-pill{font-size:11px;padding:8px 10px}.cm-maincard{padding:15px;border-radius:21px}.cm-stage-body{min-height:270px;padding:22px 14px}.cm-controls{align-items:stretch}.cm-live{width:100%}.cm-actions{width:100%}.cm-actions .cm-btn{flex:1;padding:11px 9px}.cm-classroom .writing-canvas-wrapper{aspect-ratio:2/1!important}}
        /* 100%-zoom desktop fit: compact vertical rhythm without browser zoom. */
        .cm-classroom{width:100%;max-width:1360px;margin:0 auto;padding:10px 22px 8px;}
        .cm-topbar{padding:10px 16px;margin-bottom:10px;border-radius:17px;min-height:58px;}
        .cm-brand-icon{width:38px;height:38px;font-size:21px;border-radius:12px;}
        .cm-child-pill{padding:8px 12px;font-size:12px;}
        .cm-teacherbar{padding:9px 14px;margin-bottom:10px;border-radius:14px;min-height:58px;}
        .cm-teacher-avatar{width:40px;height:40px;font-size:23px;border-radius:12px;}
        .cm-teacherbar h2{font-size:15px;}
        .cm-teacherbar p{font-size:12px;}
        .cm-maincard{padding:18px 22px;border-radius:22px;}
        .cm-stage-head{margin-bottom:12px;}
        .cm-stage-title{font-size:clamp(23px,2.5vw,32px);}
        .cm-stage-body{min-height:clamp(190px,27vh,245px);padding:18px 24px;border-radius:19px;}
        .cm-visual{font-size:clamp(40px,5vw,58px);margin-bottom:6px;}
        .cm-objective{font-size:13px;margin-bottom:10px;}
        .cm-question{font-size:clamp(18px,2.2vw,23px);margin-bottom:8px;}
        .cm-writing h3{font-size:18px;}
        .cm-writing p{font-size:13px;margin-bottom:8px;}
        .cm-classroom .writing-canvas-wrapper{width:min(100%,520px)!important;aspect-ratio:2.35/1!important;margin:8px auto!important;}
        .cm-progress-area{margin:12px 0 5px;}
        .cm-progress-track{height:8px;}
        .cm-controls{margin-top:10px;padding:9px 12px;border-radius:14px;}
        .cm-btn{padding:9px 13px;font-size:12px;border-radius:11px;}
        .cm-conversation{margin-top:9px;padding:10px 14px;font-size:13px;}
        .cm-start,.cm-finished{padding:28px 18px;border-radius:19px;}
        .cm-start-icon{font-size:44px;margin-bottom:6px;}
        .cm-start h2,.cm-finished h2{font-size:clamp(23px,3vw,31px);}
        .cm-stats{margin:12px 0;}
        @media(min-width:900px) and (min-height:760px){
          .cm-classroom{min-height:calc(100vh - 8px);display:flex;flex-direction:column;justify-content:center;}
          .cm-maincard{flex:0 0 auto;}
        }
        @media(max-height:760px) and (min-width:700px){
          .cm-classroom{padding-top:6px;padding-bottom:4px;}
          .cm-topbar{min-height:48px;padding:7px 12px;margin-bottom:7px;}
          .cm-teacherbar{min-height:46px;padding:6px 11px;margin-bottom:7px;}
          .cm-teacher-avatar{width:34px;height:34px;font-size:20px;}
          .cm-maincard{padding:12px 16px;}
          .cm-stage-body{min-height:160px;padding:12px 18px;}
          .cm-progress-area{margin:8px 0 3px;}
          .cm-controls{margin-top:7px;padding:7px 10px;}
        }
      `}</style>

      <header className="cm-topbar">
        <div className="cm-brand">
          <span className="cm-brand-icon">🌈</span>
          <span>ClassMate AI<small style={{display:"block",fontSize:11,color:"#89839f",fontWeight:550}}>My Learning Adventure</small></span>
        </div>
        <div className="cm-child-pill">🧒 {child?.name || "Little Learner"} · Age {child?.age || 5}</div>
      </header>

      <div className="cm-teacherbar">
        <div className="cm-teacher-avatar">👩‍🏫</div>
        <div>
          <h2>Your Personal AI Teacher</h2>
          <p>{status}</p>
        </div>
        {saving && <span className="cm-saving">Saving progress…</span>}
      </div>

      <div className="cm-maincard">
        {finished ? (
          <div className="cm-finished">
            <div className="cm-start-icon">🏆</div>
            <h2>Wonderful work, {child?.name || "Little Learner"}!</h2>
            <p>You completed all 12 learning adventures. Your effort made today special!</p>
            <div className="cm-stats">
              <div className="cm-stat"><strong>{answers}</strong><span>Questions answered</span></div>
              <div className="cm-stat"><strong>{correct}</strong><span>Correct answers</span></div>
              <div className="cm-stat"><strong>{topicsToReview.length}</strong><span>Topics to practise</span></div>
            </div>
          </div>
        ) : lesson && started ? (
          <>
            <div className="cm-stage-head">
              <div>
                <div className="cm-stage-kicker">Today's learning adventure</div>
                <h1 className="cm-stage-title">{currentStage?.title}</h1>
              </div>
              <span className="cm-stage-count">STAGE {step + 1} <span style={{opacity:.5}}> / </span> 12</span>
            </div>

            <div className="cm-stage-body">
              {!isWritingActivity && (
                <>
                  <div className="cm-visual">{currentStage?.visual || "🌈"}</div>
                  <p className="cm-objective">{currentStage?.learning_objective}</p>
                  <h2 className="cm-question">{currentStage?.question}</h2>
                  <span className="cm-attempts">🌟 Practice attempts: {attempts}</span>
                </>
              )}

              {isWritingActivity && (
                <div className="cm-writing">
                  <div className="cm-visual">{isWritingStage ? "✏️" : "📝"}</div>
                  <h3>{isWritingStage ? "Let's practise writing!" : "Your final writing test"}</h3>
                  <p>{isWritingStage ? "Follow the dotted letter and trace it carefully." : "Write the letter independently without tracing. You can do it!"}</p>
                  <div
                    className="writing-canvas-wrapper"
                    style={{position:"relative",width:"min(100%,600px)",aspectRatio:"2 / 1",margin:"10px auto",overflow:"hidden",border:"2px solid #d8c9f5",borderRadius:"12px",background:"#ffffff"}}
                  >
                    {isWritingStage && (
                      <canvas ref={guideCanvasRef} width={600} height={300} className="writing-guide-canvas"
                        style={{position:"absolute",inset:0,width:"100%",height:"100%",pointerEvents:"none"}} />
                    )}
                    <canvas ref={canvasRef} width={600} height={300} className="writing-canvas"
                      style={{position:"absolute",inset:0,width:"100%",height:"100%",background:"transparent",touchAction:"none",cursor:"crosshair"}}
                      onPointerDown={startDrawing} onPointerMove={draw} onPointerUp={stopDrawing}
                      onPointerCancel={stopDrawing} onPointerLeave={stopDrawing} />
                  </div>
                  {writingScore !== null && (
                    <div className="writing-result" style={{padding:"14px",margin:"12px auto",borderRadius:"14px",background:writingScore >= WRITING_PASS_SCORE ? "#e6f8e9" : "#fff2df"}}>
                      <h3>Writing similarity: {writingScore}%</h3>
                      <p>{writingFeedback}</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="cm-progress-area">
              <div className="cm-progress-label"><span>YOUR PROGRESS</span><span>{completed.length} of 12 stages completed</span></div>
              <div className="cm-progress-track"><div className="cm-progress-fill" style={{width:`${completed.length / 12 * 100}%`}} /></div>
            </div>

            <div className="cm-controls">
              <div className="cm-live"><span className="cm-live-dot" />{listening ? "Prisma is listening" : "Your teacher is teaching"}</div>
              <div className="cm-actions">
                <button className="cm-btn" onClick={toggleMute}>{muted ? "🔇 Unmute" : "🔊 Mute"}</button>
                <button className="cm-btn" onClick={pauseClass}>Ⅱ Pause class</button>
                <button className="cm-btn cm-btn-primary" onClick={goToNextStage} disabled={saving}>Next activity →</button>
              </div>
            </div>

            {transcript && (
              <div className="cm-conversation">
                <p><strong>🧒 You said:</strong> {transcript}</p>
                <p><strong>👩‍🏫 Teacher:</strong> {reply}</p>
              </div>
            )}
          </>
        ) : (
          <div className="cm-start">
            <div className="cm-start-icon">🌈</div>
            <h2>Your classroom is ready!</h2>
            <p>{status}</p>
            <button className="cm-btn cm-btn-primary" onClick={initializeClass} disabled={initializingRef.current}>Start learning 🚀</button>
          </div>
        )}
      </div>
      <div style={{textAlign:"center",padding:"18px 8px 4px",fontSize:12,color:"#938da8"}}>Learn · Practise · Play · Grow ⭐</div>
    </section>
  );
}
