'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  X, 
  Loader2, 
  UserCheck, 
  GraduationCap, 
  Sparkles, 
  CornerDownLeft, 
  AlertCircle,
  HelpCircle
} from 'lucide-react';
import { searchWithAutocomplete, SearchSuggestion } from '@/src/lib/search';

interface AutocompleteSearchBarProps {
  value?: string;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
  onSearch: (query: string) => void;
  onSelectSuggestion?: (suggestion: SearchSuggestion) => void;
  onClose?: () => void;
}

export default function AutocompleteSearchBar({
  value = '',
  placeholder = 'Buscar profesores, centros o alumnos...',
  autoFocus = false,
  className = '',
  inputClassName = '',
  onSearch,
  onSelectSuggestion,
  onClose
}: AutocompleteSearchBarProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Sincronizar prop value
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Click outside para cerrar el menú desplegable
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Función de consulta a Supabase con Debounce (300ms)
  const fetchSuggestions = useCallback(async (searchTerm: string) => {
    const cleanTerm = searchTerm.trim();
    if (!cleanTerm) {
      setSuggestions([]);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    try {
      const results = await searchWithAutocomplete(cleanTerm, 0.25);
      setSuggestions(results);
      setIsOpen(true);
      setSelectedIndex(-1);
    } catch (err) {
      console.warn('Error en la búsqueda con Supabase:', err);
      setSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Manejador del cambio de texto con debounce de 300ms
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    if (!val.trim()) {
      setSuggestions([]);
      setIsOpen(false);
      setIsLoading(false);
      setHasSearched(false);
      return;
    }

    setIsLoading(true);
    setIsOpen(true);

    debounceTimerRef.current = setTimeout(() => {
      fetchSuggestions(val);
    }, 300);
  };

  // Manejo de teclado (Flecha Arriba, Flecha Abajo, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true);
        return;
      }
      setSelectedIndex((prev) => (prev < suggestions.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : suggestions.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        handleSelect(suggestions[selectedIndex]);
      } else {
        handleSubmit();
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSelectedIndex(-1);
      if (onClose) onClose();
    }
  };

  const handleSelect = (suggestion: SearchSuggestion) => {
    setIsOpen(false);
    setSelectedIndex(-1);
    if (onSelectSuggestion) {
      onSelectSuggestion(suggestion);
    } else {
      onSearch(suggestion.title);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsOpen(false);
    setSelectedIndex(-1);
    onSearch(query);
  };

  const handleClear = () => {
    setQuery('');
    setSuggestions([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    setHasSearched(false);
    inputRef.current?.focus();
  };

  // Renderizador de Badge por tipo
  const renderBadge = (type: SearchSuggestion['type']) => {
    switch (type) {
      case 'professor':
        return (
          <span className="px-2 py-0.5 rounded-md bg-[#eab308]/15 border border-[#eab308]/40 text-[#eab308] text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Profesor
          </span>
        );
      case 'center':
        return (
          <span className="px-2 py-0.5 rounded-md bg-blue-500/15 border border-blue-500/40 text-blue-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <GraduationCap className="w-3 h-3" />
            Centro
          </span>
        );
      case 'student':
        return (
          <span className="px-2 py-0.5 rounded-md bg-purple-500/15 border border-purple-500/40 text-purple-400 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3" />
            Alumno
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Input principal */}
      <form onSubmit={handleSubmit} className="relative w-full">
        <div className={`relative flex items-center w-full bg-[#141414] border border-zinc-800 hover:border-[#eab308]/50 focus-within:border-[#eab308] focus-within:ring-2 focus-within:ring-[#eab308]/20 rounded-full px-3.5 py-2 transition-all group ${inputClassName}`}>
          
          {/* Icono de búsqueda o spinner */}
          {isLoading ? (
            <Loader2 className="w-4 h-4 text-[#eab308] animate-spin flex-shrink-0 mr-2.5" />
          ) : (
            <Search className="w-4 h-4 text-zinc-400 group-focus-within:text-[#eab308] transition-colors flex-shrink-0 mr-2.5" />
          )}

          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onFocus={() => {
              if (query.trim()) setIsOpen(true);
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            autoFocus={autoFocus}
            className="w-full bg-transparent text-white text-xs sm:text-sm placeholder:text-zinc-500 focus:outline-none font-medium pr-1"
          />

          {/* Botón para limpiar */}
          {query && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors mr-1 cursor-pointer"
              title="Limpiar"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Botón de envío */}
          <button
            type="submit"
            className="bg-[#eab308] hover:bg-[#d9a307] text-black p-1.5 rounded-full transition-all active:scale-95 flex-shrink-0 cursor-pointer shadow-sm"
            title="Buscar"
          >
            <CornerDownLeft className="w-3.5 h-3.5 stroke-[2.5]" />
          </button>
        </div>
      </form>

      {/* MENÚ DESPLEGABLE DE SUGERENCIAS */}
      {isOpen && query.trim().length > 0 && (
        <div className="absolute left-0 right-0 top-full mt-2 bg-[#0d0d0d] border border-zinc-800 rounded-2xl shadow-[0_15px_40px_rgba(0,0,0,0.85)] z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
          
          {/* Cabecera de Estado de carga */}
          {isLoading && (
            <div className="px-4 py-2.5 text-[11px] font-semibold text-zinc-400 border-b border-zinc-800/80 flex items-center gap-2 bg-[#141414]/50">
              <Loader2 className="w-3.5 h-3.5 text-[#eab308] animate-spin" />
              <span>Consultando base de datos Supabase...</span>
            </div>
          )}

          {/* ESTADO 1: LISTA DE RESULTADOS DEVUELTOS POR SUPABASE */}
          {!isLoading && suggestions.length > 0 && (
            <div className="max-h-[340px] overflow-y-auto divide-y divide-zinc-900/80 p-1.5 custom-scrollbar">
              {suggestions.map((item, index) => {
                const isSelected = index === selectedIndex;
                return (
                  <div
                    key={`${item.type}-${item.id}-${index}`}
                    onClick={() => handleSelect(item)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`flex items-center justify-between gap-3 p-2.5 rounded-xl cursor-pointer transition-all ${
                      isSelected 
                        ? 'bg-[#eab308]/15 border border-[#eab308]/40' 
                        : 'hover:bg-[#161616] border border-transparent'
                    }`}
                  >
                    {/* Izquierda: Avatar e Info */}
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {item.avatarUrl ? (
                        <img
                          src={item.avatarUrl}
                          alt={item.title}
                          className="w-9 h-9 rounded-full object-cover border border-zinc-800 flex-shrink-0"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-300 font-bold text-xs flex-shrink-0">
                          {item.type === 'professor' ? (
                            <UserCheck className="w-4 h-4 text-[#eab308]" />
                          ) : item.type === 'center' ? (
                            <GraduationCap className="w-4 h-4 text-blue-400" />
                          ) : (
                            <Sparkles className="w-4 h-4 text-purple-400" />
                          )}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs sm:text-sm font-bold truncate ${
                            isSelected ? 'text-[#eab308]' : 'text-white'
                          }`}>
                            {item.title}
                          </span>

                          {/* Indicador de tolerancia a errores (Fuzzy) */}
                          {item.isFuzzy && (
                            <span className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20">
                              <AlertCircle className="w-2.5 h-2.5" />
                              Quizás quisiste decir
                            </span>
                          )}
                        </div>

                        {item.subtitle && (
                          <p className="text-[11px] text-zinc-400 truncate">
                            {item.subtitle}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Derecha: Badge de Tipo */}
                    <div className="flex-shrink-0">
                      {renderBadge(item.type)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ESTADO 2: ESTADO VACÍO LIMPIO SI SUPABASE NO TIENE COINCIDENCIAS */}
          {!isLoading && hasSearched && suggestions.length === 0 && (
            <div className="px-5 py-6 text-center select-none">
              <div className="w-10 h-10 mx-auto mb-2.5 rounded-full bg-[#141414] border border-zinc-800 flex items-center justify-center text-zinc-500">
                <HelpCircle className="w-5 h-5 text-zinc-400" />
              </div>
              <p className="text-xs sm:text-sm font-bold text-zinc-200">
                No se encontraron resultados para &quot;<span className="text-[#eab308]">{query}</span>&quot;
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                Verifica la ortografía o intenta buscar con otro nombre registrado en la base de datos.
              </p>
            </div>
          )}

          {/* Pie del menú desplegable */}
          <div 
            onClick={() => handleSubmit()}
            className="px-4 py-2.5 bg-[#121212] border-t border-zinc-800 flex items-center justify-between text-[11px] text-zinc-400 hover:text-white hover:bg-zinc-800/80 cursor-pointer transition-colors"
          >
            <div className="flex items-center gap-2">
              <Search className="w-3.5 h-3.5 text-[#eab308]" />
              <span>Ver todos los resultados para &quot;<strong>{query}</strong>&quot;</span>
            </div>
            <span className="text-[10px] bg-zinc-800 px-1.5 py-0.5 rounded text-zinc-300 font-mono">
              ↵ Enter
            </span>
          </div>

        </div>
      )}
    </div>
  );
}
