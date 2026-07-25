import React, { useState, useEffect, useRef } from 'react';
import { MapPin } from 'lucide-react';

const CityAutocomplete = ({ cities = [], value, onChange, name, placeholder, className, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filtered, setFiltered] = useState([]);
  const wrapperRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [wrapperRef]);

  const handleInputChange = (e) => {
    // Propagate the change immediately to allow free text typing
    onChange(e); 
    
    const inputValue = e.target.value;
    if (inputValue.length > 1 && cities.length > 0) {
      const search = inputValue.toLowerCase();
      // Handle both object arrays (with nombre property) and string arrays
      const matches = cities.filter(c => {
         const cityName = typeof c === 'string' ? c : (c.nombre || '');
         return cityName.toLowerCase().includes(search);
      }).slice(0, 8); // Limit suggestions to keep UI clean
      
      setFiltered(matches);
      setIsOpen(matches.length > 0);
    } else {
      setFiltered([]);
      setIsOpen(false);
    }
  };

  const handleSelect = (city) => {
    const cityName = typeof city === 'string' ? city : (city.nombre || '');
    
    // Create synthetic event to maintain compatibility with existing handlers
    const event = {
      target: {
        name: name,
        value: cityName,
        type: 'text'
      }
    };
    
    onChange(event);
    setIsOpen(false);
  };

  return (
    <div className="relative w-full" ref={wrapperRef}>
      <input
        type="text"
        name={name}
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        disabled={disabled}
        className={className}
        autoComplete="off"
      />
      {isOpen && filtered.length > 0 && (
        <div className="absolute z-50 w-full bg-white border border-gray-200 rounded-md shadow-lg mt-1 max-h-48 overflow-y-auto">
          {filtered.map((city, idx) => (
            <div
              key={idx}
              className="px-4 py-2 hover:bg-gray-100 cursor-pointer text-sm text-gray-700 flex items-center gap-2"
              onClick={() => handleSelect(city)}
            >
              <MapPin className="w-3 h-3 text-gray-400 shrink-0" />
              <span className="truncate">{typeof city === 'string' ? city : (city.nombre || '')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CityAutocomplete;