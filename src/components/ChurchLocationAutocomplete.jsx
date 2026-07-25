import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Check, ChevronsUpDown } from 'lucide-react';
import { useAppData } from '@/context/AppDataContext';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const ChurchLocationAutocomplete = ({ 
    value, 
    onChange, 
    placeholder = "Buscar iglesia o ciudad...", 
    disabled = false,
    className
}) => {
    const { user } = useAuth();
    const { getIglesiasList, getCiudadesList } = useAppData();
    
    const [open, setOpen] = useState(false);
    const [inputValue, setInputValue] = useState(value || "");
    const [options, setOptions] = useState([]);
    const [filteredOptions, setFilteredOptions] = useState([]);
    const wrapperRef = useRef(null);

    // Load and combine data
    useEffect(() => {
        if (!user) return;
        const contextId = user.parishId || user.dioceseId;
        if (!contextId) return;

        const iglesias = getIglesiasList(contextId) || [];
        const ciudades = getCiudadesList(contextId) || [];

        const churchOptions = iglesias.map(i => {
            const name = i.nombre || i.name || '';
            const city = i.ciudad || i.municipio || i.city || '';
            const label = city ? `${name} - ${city}`.toUpperCase() : name.toUpperCase();
            return { value: label, label, type: 'church' };
        });

        const cityOptions = ciudades.map(c => {
            const name = typeof c === 'string' ? c : (c.nombre || c.name || '');
            return { value: name.toUpperCase(), label: name.toUpperCase(), type: 'city' };
        });

        // Prioritize churches, then cities
        setOptions([...churchOptions, ...cityOptions]);
    }, [user, getIglesiasList, getCiudadesList]);

    // Sync internal input with prop value
    useEffect(() => {
        setInputValue(value || "");
    }, [value]);

    // Filter options based on input
    useEffect(() => {
        if (!inputValue) {
            setFilteredOptions([]);
            return;
        }
        
        const search = inputValue.toLowerCase();
        const filtered = options.filter(opt => 
            opt.label.toLowerCase().includes(search)
        ).slice(0, 10); // Limit to 10 results for performance
        
        setFilteredOptions(filtered);
    }, [inputValue, options]);

    // Handle outside click
    useEffect(() => {
        function handleClickOutside(event) {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
                setOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [wrapperRef]);

    const handleInputChange = (e) => {
        const val = e.target.value;
        setInputValue(val);
        setOpen(true);
        onChange(val); // Allow free text input
    };

    const handleSelect = (option) => {
        setInputValue(option.value);
        onChange(option.value);
        setOpen(false);
    };

    return (
        <div className="relative w-full" ref={wrapperRef}>
            <div className="relative">
                <input
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={() => setOpen(true)}
                    placeholder={placeholder}
                    disabled={disabled}
                    className={cn(
                        "flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4B7BA7] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 uppercase",
                        className
                    )}
                />
                <div className="absolute right-3 top-2.5 text-gray-400 pointer-events-none">
                    <ChevronsUpDown className="h-4 w-4" />
                </div>
            </div>

            {open && filteredOptions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-white rounded-md border border-gray-200 shadow-lg max-h-60 overflow-y-auto">
                    {filteredOptions.map((option, idx) => (
                        <div
                            key={`${option.value}-${idx}`}
                            className={cn(
                                "relative flex cursor-pointer select-none items-center rounded-sm px-3 py-2 text-sm outline-none hover:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                                inputValue === option.value && "bg-blue-50 text-blue-700"
                            )}
                            onClick={() => handleSelect(option)}
                        >
                            <MapPin className={cn("mr-2 h-4 w-4", option.type === 'church' ? "text-blue-500" : "text-gray-400")} />
                            <span className="truncate">{option.label}</span>
                            {inputValue === option.value && (
                                <Check className="ml-auto h-4 w-4 text-blue-600" />
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ChurchLocationAutocomplete;