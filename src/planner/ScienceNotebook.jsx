import { useState } from 'react'
import { useMapScale } from './MapViewport.jsx'

const lessons = [
  { title: 'Life clues', heading: 'A clue is not a discovery of life.',
    text: 'At Cheyava Falls, Perseverance found organic matter alongside unusual mineral patterns. Scientists call these potential biosignatures. More work is needed to test biological and nonbiological explanations.',
    action: 'Look for fine sediment layers and water-altered rocks. Record the setting before collecting anything.',
    url: 'https://www.jpl.nasa.gov/news/nasa-says-mars-rover-discovered-potential-biosignature-last-year/' },
  { title: 'Dust & suits', heading: 'Keep Mars dust outside.',
    text: 'Dust can affect seals, equipment and crew health. Jezero measurements show chlorine-bearing materials, but total chlorine is not the same as a perchlorate concentration. This map has no measured toxicity layer.',
    action: 'Mission idea: photograph loose ground, inspect boots and tools, and plan dust removal before returning indoors. Growing food would need a controlled system and treated material.',
    url: 'https://doi.org/10.1029/2025JE008943' },
  { title: 'Protect samples', heading: 'Leave a clean trail of evidence.',
    text: 'Earth microbes and residues could confuse a search for Martian life. Three Forks holds a depot of sealed sample tubes. The sample markers here show collection areas, not the current positions of those tubes.',
    action: 'Mission idea: document first, keep tools clean, and avoid disturbing cached hardware. Robot-only zones in your research are a proposed concept, not an official NASA exclusion rule.',
    url: 'https://science.nasa.gov/resource/perseverances-three-forks-sample-depot-map/' },
]

export default function ScienceNotebook() {
  const [index, setIndex] = useState(0)
  const lesson = lessons[index]
  return <section className="science-notebook" aria-label="Life and science field notes">
    <p className="expedition-eyebrow">THE EXPLORER’S NOTEBOOK</p>
    <div role="group" aria-label="Field note topics">
      {lessons.map((item, i) => <button type="button" key={item.title} aria-pressed={i === index} onClick={() => setIndex(i)}>{item.title}</button>)}
    </div>
    <h2>{lesson.heading}</h2><p>{lesson.text}</p><p>{lesson.action}</p>
    <a href={lesson.url} target="_blank" rel="noreferrer">Read the evidence ↗</a>
  </section>
}

export function SiteFieldNotes({ site }) {
  if (!site.fieldQuestion) return null
  return <div className="science-field-notes">
    {site.image && <figure><a href={site.image.source} target="_blank" rel="noreferrer"><img src={site.image.path} alt={site.image.alt} loading="lazy" /></a><figcaption>{site.image.caption}<br />{site.image.credit}</figcaption></figure>}
    <h3>Your science question</h3><p>{site.fieldQuestion}</p>
    <h3>Look for</h3><p>{site.observe}</p>
    <p className="science-evidence">{site.evidence}</p>
    <a href="https://mars.nasa.gov/mars2020/multimedia/raw-images/" target="_blank" rel="noreferrer">Explore Perseverance’s raw images ↗</a>
  </div>
}

export function SampleMarkers({ sites, size, locate, selected, onSelect }) {
  const r = size * .008 * useMapScale()
  return <g className="science-samples">{sites.map((site) => {
    const point = locate(site)
    const activate = (event) => { event.stopPropagation(); onSelect(site) }
    return <g key={site.id} transform={`translate(${point.x} ${point.y})`} role="button" tabIndex="0"
      aria-label={`Sample: ${site.name}`} aria-pressed={site.id === selected?.id} onClick={activate}
      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(event) } }}>
      <path d={`M0 ${-r} L${r} 0 L0 ${r} L${-r} 0 Z`} fill={site.rock.includes('Sedimentary') ? '#e3b674' : '#9bcbd7'} stroke="#171d26" strokeWidth={r * .25} />
    </g>
  })}</g>
}

export function SamplePanel({ data, selected, onSelect }) {
  return <section className="science-sample-panel" aria-label="Perseverance sample collection sites">
    <h2>Rocks worth bringing home</h2>
    <select aria-label="Inspect collected sample" value={selected?.id ?? ''} onChange={(event) => onSelect(data.sites.find((site) => site.id === event.target.value))}>
      <option disabled value="">Choose a collection site</option>
      {data.sites.map((site) => <option key={site.id} value={site.id}>{site.name}</option>)}
    </select>
    {selected && <div aria-label="Selected sample"><h3>{selected.name}</h3><dl className="expedition-readings">
      <dt>Material</dt><dd>{selected.rock}</dd><dt>Sample type</dt><dd>{selected.type}</dd><dt>Collection sol</dt><dd>{selected.sol}</dd>
      <dt>Region</dt><dd>{selected.region}</dd><dt>Location</dt><dd>{selected.latitude.toFixed(5)}° N · {selected.longitude.toFixed(5)}° E</dd>
    </dl></div>}
    <p>◆ Collection sites · gold: sedimentary · blue: other materials</p>
    <p>{data.note}</p><a href={data.source} target="_blank" rel="noreferrer">NASA map data · saved {data.retrieved} ↗</a>
  </section>
}
