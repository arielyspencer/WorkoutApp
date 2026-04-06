import React, { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown } from 'lucide-react';

export default function SearchableDropdown({ options, value, onChange, placeholder = "Select an option...", className = "", buttonStyle = {} }) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef(null);

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filteredOptions = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedOption = options.find(o => o.value === value);

  return (
    <div ref={wrapperRef} className="relative w-full text-left">
      <button 
        type="button" 
        className={className || "w-full text-left flex justify-between items-center"} 
        style={className ? buttonStyle : {
          background: '#000',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
          padding: '0.75rem 1rem',
          borderRadius: '8px',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s',
          ...buttonStyle
        }}
        onClick={() => { setIsOpen(!isOpen); setSearchTerm(''); }}
      >
        <span className={selectedOption ? "" : "opacity-60"}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <ChevronDown size={16} className="text-secondary" />
      </button>

      {isOpen && (
        <div 
          className="absolute z-50 w-full mt-1 bg-gray-900 border rounded shadow-lg max-h-60 overflow-y-auto"
          style={{ borderColor: 'var(--border-subtle)', background: '#0a0a0a' }}
        >
          <div className="sticky top-0 bg-black p-2 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <div className="relative">
              <Search size={14} className="absolute left-2 top-2.5 text-secondary" />
              <input 
                type="text" 
                className="w-full bg-gray-900 p-1 pl-7 text-sm rounded border-none focus:outline-none" 
                placeholder="Search..." 
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                autoFocus
              />
            </div>
          </div>
          <ul className="p-0 m-0 list-none">
            {filteredOptions.length > 0 ? filteredOptions.map(opt => (
              <li 
                key={opt.value} 
                className="p-2 cursor-pointer hover:bg-gray-800 text-sm"
                onClick={() => {
                  onChange(opt.value);
                  setIsOpen(false);
                }}
              >
                {opt.label}
              </li>
            )) : (
              <li className="p-2 text-sm text-secondary">No matching options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
