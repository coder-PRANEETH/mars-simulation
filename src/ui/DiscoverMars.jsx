import { useId, useState } from 'react';
import Icon from './Icon.jsx';

// Short lessons connect a real Mars fact to something children can explore here.
const discoveries = [
  {
    question: 'Could you jump higher on Mars?',
    fact: 'Yes! Mars has about 38% of Earth’s gravity. With the same push, you can jump higher and stay in the air longer.',
    activity: 'Try it: choose Walk, then press Space to jump.',
    source: 'https://www.jpl.nasa.gov/news/press_kits/insight/landing/facts/mars-at-a-glance/',
  },
  {
    question: 'Why is the Red Planet red?',
    fact: 'Iron minerals in the soil react with oxygen and turn rusty red. That rusty dust gives Mars its colour.',
    activity: 'Look around: the rusty colours here help show what Mars might look like. The spacecraft pictures underneath are grey.',
    source: 'https://science.nasa.gov/mars/facts/',
  },
  {
    question: 'Did Jezero crater have a lake?',
    fact: 'Yes! Jezero crater held a lake long ago. Rivers carried sand and mud into it, leaving a fan of rocks called a delta.',
    activity: 'Try it: open the Jezero map and find the Western Delta front science site.',
    source: 'https://science.nasa.gov/mission/mars-2020-perseverance/science-highlights/',
  },
  {
    question: 'Have we found life on Mars?',
    fact: 'Not yet. Perseverance found a rock with possible clues called potential biosignatures. Scientists still need to test how those clues formed.',
    activity: 'Try it: open the Jezero map, then Life & science. Find Cheyava Falls in the science sites.',
    source: 'https://www.jpl.nasa.gov/news/nasa-says-mars-rover-discovered-potential-biosignature-last-year/',
  },
  {
    question: 'Can a spacesuit get hot on cold Mars?',
    fact: 'Yes! Your body makes heat when you work. A spacesuit needs cooling as well as oxygen, even when the air outside is very cold.',
    activity: 'Try it: plan a Marswalk and compare oxygen use with cooling limits.',
    source: 'https://www.nasa.gov/reference/11-0-spacesuits-vol-2/',
  },
];

export default function DiscoverMars({ compact = false }) {
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const id = useId();
  const discovery = discoveries[index];
  return <aside className={`sim-discovery sim-interactive ${compact ? 'is-compact' : ''} ${revealed ? 'is-revealed' : ''}`} aria-label="Discover Mars">
    <svg className="sim-orbit-drawing" viewBox="0 0 280 180" aria-hidden="true">
      <defs>
        <radialGradient id={`${id}-planet`} cx="30%" cy="25%" r="80%"><stop stopColor="#d99b70" /><stop offset=".65" stopColor="#8b4c35" /><stop offset="1" stopColor="#241c23" /></radialGradient>
        <clipPath id={`${id}-disc`}><circle cx="140" cy="86" r="53" /></clipPath>
      </defs>
      <circle cx="140" cy="86" r="69" fill="none" stroke="currentColor" opacity=".14" strokeDasharray="2 7" />
      <circle cx="140" cy="86" r="53" fill={`url(#${id}-planet)`} />
      <g clipPath={`url(#${id}-disc)`} fill="none" stroke="#f6c4a0" opacity=".24">
        <path d="M75 63q44-31 86 0t50-1M80 77q40-26 81 2t56 4M80 106q30 20 62-2t62 3M101 35q-2 29 27 44t-7 60M155 34q-21 25 9 51t-8 56" />
      </g>
      <path d="M33 129C67 165 248 87 249 29" fill="none" stroke="currentColor" opacity=".48" strokeDasharray="3 7" />
      <path d="M21 132h48m0 0 18-18M211 38h40m-20-8v16" fill="none" stroke="currentColor" opacity=".6" />
      <circle cx="242" cy="40" r="3" fill="currentColor" />
      <text x="27" y="157" fill="currentColor" fontSize="8" letterSpacing="2">MARS / PLANET 04</text>
    </svg>
    <div className="sim-discovery-heading"><span>DISCOVER MARS</span><span>{String(index + 1).padStart(2, '0')} / {String(discoveries.length).padStart(2, '0')}</span></div>
    <h3>{discovery.question}</h3>
    <button className="sim-answer-button" aria-expanded={revealed} aria-controls={`${id}-answer`} onClick={() => setRevealed(!revealed)}>{revealed ? 'Hide answer' : 'Reveal answer'}<span aria-hidden="true">{revealed ? '−' : '+'}</span></button>
    <div id={`${id}-answer`} className="sim-discovery-answer" hidden={!revealed}>
      <p>{discovery.fact}</p><p className="sim-discovery-activity">{discovery.activity}</p>
      <a href={discovery.source} target="_blank" rel="noreferrer">Learn more with NASA ↗</a>
    </div>
    <button className="sim-next-discovery" onClick={() => { setIndex((index + 1) % discoveries.length); setRevealed(false); }}>Next question<Icon name="arrow" size={17} /></button>
  </aside>;
}
