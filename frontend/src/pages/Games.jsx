import { API } from "../config";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const games = [
  {
    id: "alphabet",
    title: "Alphabet Match",
    icon: "🔤",
    questions: [
      { q: "Which letter is for Apple?", options: ["A", "B", "C"], answer: "A", emoji: "🍎" },
      { q: "Which letter is for Ball?", options: ["D", "B", "E"], answer: "B", emoji: "⚽" },
      { q: "Which letter is for Cat?", options: ["C", "F", "G"], answer: "C", emoji: "🐱" },
      { q: "Which letter is for Dog?", options: ["A", "D", "F"], answer: "D", emoji: "🐶" },
      { q: "Which letter is for Elephant?", options: ["E", "H", "I"], answer: "E", emoji: "🐘" }
    ]
  },
  {
    id: "counting",
    title: "Count the Objects",
    icon: "🔢",
    questions: [
      { q: "How many apples?", options: ["2", "3", "4"], answer: "3", emoji: "🍎🍎🍎" },
      { q: "How many stars?", options: ["4", "5", "6"], answer: "5", emoji: "⭐⭐⭐⭐⭐" },
      { q: "How many balls?", options: ["1", "2", "3"], answer: "2", emoji: "⚽⚽" },
      { q: "How many flowers?", options: ["3", "4", "5"], answer: "4", emoji: "🌸🌸🌸🌸" },
      { q: "How many bananas?", options: ["2", "3", "4"], answer: "2", emoji: "🍌🍌" }
    ]
  },
  {
    id: "colours",
    title: "Colour Challenge",
    icon: "🌈",
    questions: [
      { q: "Which colour is the sky on a clear day?", options: ["Blue", "Green", "Red"], answer: "Blue", emoji: "☀️" },
      { q: "Which colour is a ripe banana?", options: ["Pink", "Yellow", "Blue"], answer: "Yellow", emoji: "🍌" },
      { q: "Which colour is a strawberry?", options: ["Red", "Purple", "Green"], answer: "Red", emoji: "🍓" },
      { q: "Which colour are most leaves?", options: ["Orange", "Green", "Black"], answer: "Green", emoji: "🍃" },
      { q: "Which colour is an orange fruit?", options: ["Blue", "Orange", "Pink"], answer: "Orange", emoji: "🍊" }
    ]
  },
  {
    id: "animals",
    title: "Animal Quiz",
    icon: "🐘",
    questions: [
      { q: "Which animal has a long trunk?", options: ["Lion", "Elephant", "Rabbit"], answer: "Elephant", emoji: "🐘" },
      { q: "Which animal is called the king of the jungle?", options: ["Lion", "Fish", "Cat"], answer: "Lion", emoji: "🦁" },
      { q: "Which animal has long ears?", options: ["Rabbit", "Tiger", "Fish"], answer: "Rabbit", emoji: "🐰" },
      { q: "Which animal lives in water?", options: ["Monkey", "Fish", "Lion"], answer: "Fish", emoji: "🐟" },
      { q: "Which animal has a very long neck?", options: ["Giraffe", "Dog", "Rabbit"], answer: "Giraffe", emoji: "🦒" }
    ]
  }
];

export default function Games() {
  const navigate = useNavigate();

  const child = (() => {
    try {
      return JSON.parse(sessionStorage.getItem("active_child") || "{}");
    } catch {
      return {};
    }
  })();

  const [selectedGame, setSelectedGame] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [score, setScore] = useState(0);
  const [stars, setStars] = useState(0);
  const [finished, setFinished] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const currentQuestion = selectedGame?.questions[questionIndex];

  async function speak(text) {
    try {
      setSpeaking(true);

      const response = await fetch(`${API}/api/voice/speak`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text })
      });

      if (!response.ok) throw new Error("Voice service unavailable");

      const audioUrl = URL.createObjectURL(await response.blob());
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
      console.error("Teacher voice:", error);
      setSpeaking(false);
    }
  }

  function startGame(game) {
    setSelectedGame(game);
    setQuestionIndex(0);
    setSelectedAnswer("");
    setFeedback("");
    setScore(0);
    setFinished(false);
  }

  function checkAnswer(option) {
    if (selectedAnswer) return;

    setSelectedAnswer(option);

    if (option === currentQuestion.answer) {
      setScore(value => value + 1);
      setStars(value => value + 1);
      setFeedback("Wonderful! That's correct! ⭐");

      speak("Wonderful! That's correct! You are doing a great job!");
    } else {
      setFeedback("Nice try! Let's try another one. 😊");

      speak("Nice try, little learner! Have another look and try again.");
    }
  }

  function nextQuestion() {
    if (questionIndex === selectedGame.questions.length - 1) {
      setFinished(true);

      const key = `classmate_progress_${child.id || child.name || "learner"}`;

      try {
        const previous = JSON.parse(localStorage.getItem(key) || "{}");

        const gameResults = {
          ...(previous.gameResults || {}),
          [selectedGame.id]: {
            score,
            total: selectedGame.questions.length,
            completedAt: new Date().toISOString()
          }
        };

        localStorage.setItem(key, JSON.stringify({
          ...previous,
          gameResults,
          gameStars: (previous.gameStars || 0) + score
        }));
      } catch (error) {
        console.error("Progress saving failed:", error);
      }

      speak(`Amazing work! You finished ${selectedGame.title}. You got ${score} answers correct!`);
    } else {
      setQuestionIndex(value => value + 1);
      setSelectedAnswer("");
      setFeedback("");
    }
  }

  function exitGame() {
    setSelectedGame(null);
    setFinished(false);
    setSelectedAnswer("");
    setFeedback("");
  }

  return (
    <main className="games-page">
      <style>{`
        .games-page {
          min-height: 100vh;
          padding: 25px;
          background: linear-gradient(135deg, #f3efff, #e9f8ff);
          font-family: Arial, sans-serif;
          color: #30244b;
        }
        .games-top {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        .games-card {
          max-width: 850px;
          margin: 35px auto;
          padding: 30px;
          background: white;
          border-radius: 24px;
          box-shadow: 0 8px 30px #49357b18;
          text-align: center;
        }
        .games-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 18px;
          margin-top: 25px;
        }
        .game-choice {
          min-height: 150px;
          border: 2px solid #e7defc;
          background: #faf8ff;
          border-radius: 18px;
          padding: 20px;
          cursor: pointer;
          font-size: 19px;
          color: #49357b;
        }
        .game-choice:hover {
          background: #eee7ff;
          transform: translateY(-2px);
        }
        .game-icon {
          display: block;
          font-size: 48px;
          margin-bottom: 12px;
        }
        .game-question {
          font-size: 25px;
          margin: 25px 0;
        }
        .game-picture {
          font-size: 75px;
          margin: 20px;
          overflow-wrap: anywhere;
        }
        .game-options {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 12px;
        }
        .game-options button, .games-page button.action {
          border: 0;
          border-radius: 12px;
          padding: 14px 22px;
          background: #7650cf;
          color: white;
          font-size: 18px;
          cursor: pointer;
        }
        .game-options button:disabled {
          opacity: .65;
          cursor: default;
        }
        .game-feedback {
          margin: 25px 0;
          font-size: 21px;
          font-weight: bold;
          color: #6841b6;
        }
        .game-stars {
          font-size: 20px;
          font-weight: bold;
        }
        @media(max-width: 600px) {
          .games-page { padding: 12px; }
          .games-card { padding: 18px; }
          .game-question { font-size: 21px; }
        }
      `}</style>

      <header className="games-top">
        <h2>🎮 ClassMate AI Games</h2>
        <button className="action" onClick={() => navigate("/classroom")}>
          ← Back to Classroom
        </button>
      </header>

      <section className="games-card">
        {!selectedGame ? (
          <>
            <div style={{ fontSize: 65 }}>👩‍🏫</div>
            <h1>Hello {child.name || "Little Learner"}!</h1>
            <p>Choose a fun game. Let's learn by playing!</p>

            <div className="games-grid">
              {games.map(game => (
                <button
                  className="game-choice"
                  key={game.id}
                  onClick={() => startGame(game)}
                >
                  <span className="game-icon">{game.icon}</span>
                  <strong>{game.title}</strong>
                </button>
              ))}
            </div>
          </>
        ) : finished ? (
          <>
            <div style={{ fontSize: 75 }}>🏆</div>
            <h1>Game Completed!</h1>
            <h2>{selectedGame.title}</h2>
            <p>You got {score} out of {selectedGame.questions.length} correct!</p>
            <p className="game-stars">⭐ Stars earned: {score}</p>
            <button className="action" onClick={() => startGame(selectedGame)}>
              Play Again
            </button>
            {" "}
            <button className="action" onClick={exitGame}>
              Choose Another Game
            </button>
          </>
        ) : (
          <>
            <p className="game-stars">
              ⭐ {stars} stars earned in this visit
            </p>

            <p>
              Question {questionIndex + 1} of {selectedGame.questions.length}
            </p>

            <h2 className="game-question">{currentQuestion.q}</h2>

            <div className="game-picture">{currentQuestion.emoji}</div>

            <div className="game-options">
              {currentQuestion.options.map(option => (
                <button
                  key={option}
                  disabled={Boolean(selectedAnswer)}
                  onClick={() => checkAnswer(option)}
                  style={{
                    background: selectedAnswer === option
                      ? option === currentQuestion.answer
                        ? "#219765"
                        : "#d87979"
                      : "#7650cf"
                  }}
                >
                  {option}
                </button>
              ))}
            </div>

            {feedback && (
              <div className="game-feedback" role="status">
                {feedback}
              </div>
            )}

            {selectedAnswer && (
              <button className="action" onClick={nextQuestion}>
                {questionIndex === selectedGame.questions.length - 1
                  ? "Finish Game 🏆"
                  : "Next Question →"}
              </button>
            )}
          </>
        )}

        {speaking && <p>🔊 Teacher is speaking...</p>}
      </section>
    </main>
  );
}
