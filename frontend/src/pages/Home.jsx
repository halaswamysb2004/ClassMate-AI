import { useNavigate } from 'react-router-dom';
import '../index.css';

const features = [
  ['🎙️', 'Talk & learn', 'Children learn naturally through friendly voice conversations.'],
  ['🧩', 'Personal lessons', 'Lessons adapt when a little learner needs another explanation.'],
  ['✍️', 'Write with confidence', 'Trace letters and practise on an interactive writing board.'],
  ['📚', 'Stories & discovery', 'Short stories and curious facts make every lesson memorable.'],
  ['🎮', 'Learn through play', 'Colourful games turn practice into a joyful activity.'],
  ['🌟', 'Celebrate progress', 'Parents can follow learning milestones and practice.']
];

export default function Home() {
  const navigate = useNavigate();
  return <div className="cm-home">
    <nav className="cm-nav"><button className="cm-brand" onClick={() => navigate('/')}><span className="cm-brand-mark">✿</span><span>classmate<span>ai</span></span></button><div className="cm-nav-links"><a href="#features">How it works</a><a href="#promise">Our approach</a></div><button className="cm-nav-cta" onClick={() => navigate('/login')}>Parent sign in <span>↗</span></button></nav>
    <main>
      <section className="cm-hero">
        <div className="cm-hero-copy"><div className="cm-eyebrow"><span className="cm-live-dot"/> A little learning, a lot of wonder</div><h1>Big discoveries<br/>start with <em>little steps.</em></h1><p className="cm-hero-text">Meet your child's friendly AI learning companion. A playful space to speak, explore, practise and grow — one happy lesson at a time.</p><div className="cm-hero-actions"><button className="cm-primary" onClick={() => navigate('/login')}>Start your child's journey <span>→</span></button><a href="#features" className="cm-text-link">Explore the experience ↓</a></div><div className="cm-trust-row"><span>✓ Parent-guided sessions</span><span>✓ Learn at their own pace</span></div></div>
        <div className="cm-hero-art"><div className="cm-orbit orbit-one"/><div className="cm-orbit orbit-two"/><div className="cm-sun-card"><span className="cm-sun">☀️</span><span className="cm-sparkle s1">✦</span><span className="cm-sparkle s2">✧</span><div className="cm-teacher-illustration">👩🏽‍🏫</div><div className="cm-speech-bubble">Hello, superstar!<small>Ready to learn something new?</small></div></div><div className="cm-float-card cm-float-letter"><b>Aa</b><span>is for Apple</span><strong>🍎</strong></div><div className="cm-float-card cm-float-stars"><span>⭐ ⭐ ⭐</span><b>You're doing great!</b></div><div className="cm-float-card cm-float-number"><b>1 2 3</b><span>Let's count together</span></div></div>
      </section>
      <section className="cm-stats"><div><strong>01</strong><span>Speak & listen</span></div><div><strong>02</strong><span>Explore & discover</span></div><div><strong>03</strong><span>Practise & play</span></div><div><strong>04</strong><span>Grow with confidence</span></div></section>
      <section className="cm-features" id="features"><div className="cm-section-intro"><span className="cm-kicker">MADE FOR CURIOUS MINDS</span><h2>More than a lesson.<br/><em>A learning adventure.</em></h2><p>Every child learns in their own way. ClassMate AI makes room for that.</p></div><div className="cm-feature-grid">{features.map(([icon,title,desc],i)=><article className={`cm-feature-card cm-feature-${i+1}`} key={title}><div className="cm-feature-icon">{icon}</div><h3>{title}</h3><p>{desc}</p><span className="cm-feature-number">0{i+1}</span></article>)}</div></section>
      <section className="cm-promise" id="promise"><div className="cm-promise-art"><div className="cm-rainbow">🌈</div><div className="cm-promise-note"><span>Little by little</span><b>learning<br/>blooms.</b><span>🌼 🌱 🌼</span></div></div><div><span className="cm-kicker">A GENTLER WAY TO LEARN</span><h2>Encouragement first.<br/><em>Progress always.</em></h2><p>From first letters to little quizzes, children are guided with patience, positive encouragement and activities designed for early learners. Parents stay in control of starting and ending each class.</p><button className="cm-primary" onClick={() => navigate('/register')}>Create a parent account <span>→</span></button></div></section>
    </main>
    <footer className="cm-footer"><button className="cm-brand" onClick={() => navigate('/')}><span className="cm-brand-mark">✿</span><span>classmate<span>ai</span></span></button><span>Learn · Practise · Play · Grow</span><small>© 2026 ClassMate AI</small></footer>
  </div>;
}
