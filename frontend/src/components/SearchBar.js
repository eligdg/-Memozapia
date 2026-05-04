import React, { useState, useEffect } from 'react';

function SearchBar({ searchTerm, onSearch }) {
  const [inputValue, setInputValue] = useState(searchTerm);

  // Búsqueda en tiempo real con debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(inputValue);
    }, 300);

    return () => clearTimeout(timer);
  }, [inputValue, onSearch]);

  return (
    <div className="search-bar">
      <input
        type="text"
        placeholder="Buscar notas..."
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        className="search-input"
      />
      {inputValue && (
        <button
          className="clear-search"
          onClick={() => setInputValue('')}
        >
          ×
        </button>
      )}
    </div>
  );
}

export default SearchBar;
