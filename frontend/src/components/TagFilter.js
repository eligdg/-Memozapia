import React from 'react';

function TagFilter({ tags, selectedTag, onSelectTag }) {
  return (
    <div className="tag-filter">
      <h3>Etiquetas</h3>
      <div className="tags-list">
        <button
          className={`tag-item ${!selectedTag ? 'active' : ''}`}
          onClick={() => onSelectTag(null)}
        >
          Todas
        </button>
        {tags.map(tag => (
          <button
            key={tag.id}
            className={`tag-item ${selectedTag === tag.name ? 'active' : ''}`}
            onClick={() => onSelectTag(tag.name)}
          >
            {tag.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export default TagFilter;
