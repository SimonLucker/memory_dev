import { useState } from 'react';

// Bottom-right query bar: stats row + local search input. Skill: query-search.
export default function QueryBar({ stats, matchCount, onSubmit, onClear }) {
  const [value, setValue] = useState('');

  function submit() {
    const text = value.trim();
    if (!text) return;
    onSubmit(text);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter') submit();
  }

  function clear() {
    setValue('');
    onClear();
  }

  const zeroMatches = matchCount === 0;
  const showClear = value.length > 0 || matchCount !== null;

  return (
    <div className="panel querybar">
      <div className="stats-row">
        <div className="stat">
          <span className="stat-label">Memories</span>
          <span className="stat-value">{stats.memories}</span>
        </div>
        <div className="stat">
          <span className="stat-label">People</span>
          <span className="stat-value">{stats.people}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Top feeling</span>
          <span className="stat-value">{stats.topFeeling || '—'}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Avg importance</span>
          <span className="stat-value">{stats.avgImportance}</span>
        </div>
      </div>

      <div className={`query-input-row${zeroMatches ? ' no-match' : ''}`}>
        <input
          type="text"
          value={value}
          placeholder="Ask a question..."
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        {showClear && (
          <button type="button" className="query-clear" aria-label="Clear" onClick={clear}>
            ✕
          </button>
        )}
        <button type="button" className="query-send" aria-label="Ask" onClick={submit}>
          ↑
        </button>
      </div>

      <div className="chip-row">
        {matchCount !== null && (
          <span className="chip chip-static">{matchCount} match{matchCount === 1 ? '' : 'es'}</span>
        )}
      </div>
    </div>
  );
}
