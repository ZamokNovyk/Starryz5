'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type TabType = 
  | 'home' 
  | 'professor' 
  | 'student' 
  | 'tools' 
  | 'center' 
  | 'search' 
  | 'admin' 
  | 'profile' 
  | 'general';

export interface PwaTab {
  id: string;
  title: string;
  pathname: string;
  search: string;
  type: TabType;
  previewSubtitle?: string;
  updatedAt: number;
}

interface PwaTabsContextValue {
  isPwa: boolean;
  togglePwaSimulation: () => void;
  tabs: PwaTab[];
  activeTabId: string;
  activeTab: PwaTab | undefined;
  isTabsSwitcherOpen: boolean;
  setIsTabsSwitcherOpen: (open: boolean) => void;
  switchTab: (id: string, onNavigate?: (path: string, search?: string) => void) => void;
  closeTab: (id: string, onNavigate?: (path: string, search?: string) => void) => void;
  closeAllTabs: (onNavigate?: (path: string, search?: string) => void) => void;
  createNewTab: (initialPath?: string, onNavigate?: (path: string, search?: string) => void) => void;
  syncCurrentRoute: (pathname: string, search: string, customTitle?: string) => void;
}

const PwaTabsContext = createContext<PwaTabsContextValue | undefined>(undefined);

const STORAGE_KEY = 'starryz_pwa_tabs_v1';
const ACTIVE_TAB_KEY = 'starryz_pwa_active_tab_v1';
const FORCE_PWA_KEY = 'starryz_force_pwa_mode';

function formatSlug(slug: string): string {
  if (!slug) return '';
  return slug
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function getTabMetadata(pathname: string, search: string): { title: string; type: TabType; previewSubtitle: string } {
  const urlParams = new URLSearchParams(search);
  const q = urlParams.get('q');

  if (pathname === '/search' || (pathname === '/' && q)) {
    return {
      title: q ? `Búsqueda: ${q}` : 'Buscador',
      type: 'search',
      previewSubtitle: q ? `Filtro "${q}"` : 'Directorio escolar'
    };
  }

  if (pathname === '/') {
    return {
      title: 'Inicio • Campus',
      type: 'home',
      previewSubtitle: 'Explorar rankings y actividad'
    };
  }

  if (pathname.startsWith('/profesores/')) {
    const slug = pathname.replace('/profesores/', '');
    const name = formatSlug(slug) || 'Docente';
    return {
      title: `Prof. ${name}`,
      type: 'professor',
      previewSubtitle: 'Perfil docente y opiniones'
    };
  }

  if (pathname.startsWith('/estudiantes/')) {
    const slug = pathname.replace('/estudiantes/', '');
    const name = formatSlug(slug) || 'Estudiante';
    return {
      title: `${name}`,
      type: 'student',
      previewSubtitle: 'Perfil estudiantil y flechazos'
    };
  }

  if (pathname.startsWith('/centros/') || pathname.startsWith('/instituciones/')) {
    const slug = pathname.replace('/centros/', '').replace('/instituciones/', '');
    const name = formatSlug(slug) || 'Institución';
    return {
      title: `${name}`,
      type: 'center',
      previewSubtitle: 'Comunidad del centro educativo'
    };
  }

  if (pathname === '/herramientas') {
    return {
      title: 'Herramientas',
      type: 'tools',
      previewSubtitle: 'Colección de utilidades de estudio'
    };
  }

  if (pathname === '/herramientas/comprimirpdf' || pathname === '/herramientas/compresor-pdf') {
    return {
      title: 'Compresor PDF',
      type: 'tools',
      previewSubtitle: 'Optimización algorítmica local'
    };
  }

  if (pathname === '/herramientas/organizadorpdf' || pathname === '/herramientas/organizador-pdf') {
    return {
      title: 'Organizador PDF',
      type: 'tools',
      previewSubtitle: 'Edición y ensamble de hojas'
    };
  }

  if (pathname === '/herramientas/dividirpdf' || pathname === '/herramientas/dividir-pdf') {
    return {
      title: 'Dividir PDF',
      type: 'tools',
      previewSubtitle: 'Corte y extracción por rangos'
    };
  }

  if (pathname === '/herramientas/ruleta') {
    return {
      title: 'Ruleta Sorteos',
      type: 'tools',
      previewSubtitle: 'Participación y sorteos en vivo'
    };
  }

  if (pathname === '/herramientas/grupos') {
    return {
      title: 'Formador Grupos',
      type: 'tools',
      previewSubtitle: 'Equipos y dinámicas aleatorias'
    };
  }

  if (pathname.startsWith('/perfil')) {
    return {
      title: 'Mi Perfil',
      type: 'profile',
      previewSubtitle: 'Configuración y estadísticas'
    };
  }

  if (pathname === '/admin') {
    return {
      title: 'Panel Admin',
      type: 'admin',
      previewSubtitle: 'Administración de Starryz 5'
    };
  }

  return {
    title: 'Starryz 5',
    type: 'general',
    previewSubtitle: pathname
  };
}

export function PwaTabsProvider({ children }: { children: ReactNode }) {
  const [isPwa, setIsPwa] = useState(false);
  const [isTabsSwitcherOpen, setIsTabsSwitcherOpen] = useState(false);

  // Tabs list and active tab
  const [tabs, setTabs] = useState<PwaTab[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Error cargando pestañas de PWA:', e);
    }

    const initMeta = getTabMetadata(
      typeof window !== 'undefined' ? window.location.pathname : '/',
      typeof window !== 'undefined' ? window.location.search : ''
    );

    return [
      {
        id: 'tab_init',
        title: initMeta.title,
        pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
        search: typeof window !== 'undefined' ? window.location.search : '',
        type: initMeta.type,
        previewSubtitle: initMeta.previewSubtitle,
        updatedAt: Date.now()
      }
    ];
  });

  const [activeTabId, setActiveTabId] = useState<string>(() => {
    if (typeof window === 'undefined') return 'tab_init';
    const savedActive = localStorage.getItem(ACTIVE_TAB_KEY);
    return savedActive || 'tab_init';
  });

  // Detect PWA mode
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkPwaStatus = () => {
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
      const isIos = (window.navigator as any).standalone === true;
      const isFullscreen = window.matchMedia('(display-mode: fullscreen)').matches;
      const searchParams = new URLSearchParams(window.location.search);
      const isParamPwa = searchParams.get('source') === 'pwa' || searchParams.get('pwa') === '1';
      const isForced = localStorage.getItem(FORCE_PWA_KEY) === 'true';

      setIsPwa(isStandalone || isIos || isFullscreen || isParamPwa || isForced);
    };

    checkPwaStatus();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    const handleChange = () => checkPwaStatus();
    mediaQuery.addEventListener?.('change', handleChange);
    window.addEventListener('appinstalled', handleChange);

    return () => {
      mediaQuery.removeEventListener?.('change', handleChange);
      window.removeEventListener('appinstalled', handleChange);
    };
  }, []);

  // Save tabs to local storage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tabs));
      localStorage.setItem(ACTIVE_TAB_KEY, activeTabId);
    } catch (e) {
      console.error('Error guardando pestañas en localStorage:', e);
    }
  }, [tabs, activeTabId]);

  // Toggle PWA Simulation for testing/preview
  const togglePwaSimulation = useCallback(() => {
    setIsPwa(prev => {
      const next = !prev;
      if (typeof window !== 'undefined') {
        localStorage.setItem(FORCE_PWA_KEY, next ? 'true' : 'false');
      }
      return next;
    });
  }, []);

  // Sync current active tab with the active route
  const syncCurrentRoute = useCallback((pathname: string, search: string, customTitle?: string) => {
    const meta = getTabMetadata(pathname, search);
    const finalTitle = customTitle || meta.title;

    setTabs(prev => {
      const exists = prev.some(t => t.id === activeTabId);
      if (!exists) {
        const newTab: PwaTab = {
          id: activeTabId || 'tab_' + Math.random().toString(36).substring(2, 9),
          title: finalTitle,
          pathname,
          search,
          type: meta.type,
          previewSubtitle: meta.previewSubtitle,
          updatedAt: Date.now()
        };
        return [...prev, newTab];
      }

      return prev.map(tab => {
        if (tab.id === activeTabId) {
          return {
            ...tab,
            title: finalTitle,
            pathname,
            search,
            type: meta.type,
            previewSubtitle: meta.previewSubtitle,
            updatedAt: Date.now()
          };
        }
        return tab;
      });
    });
  }, [activeTabId]);

  // Switch to an existing tab
  const switchTab = useCallback((id: string, onNavigate?: (path: string, search?: string) => void) => {
    const target = tabs.find(t => t.id === id);
    if (!target) return;

    setActiveTabId(id);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate(target.pathname, target.search);
    }
  }, [tabs]);

  // Create and switch to a new tab
  const createNewTab = useCallback((initialPath = '/', onNavigate?: (path: string, search?: string) => void) => {
    const meta = getTabMetadata(initialPath, '');
    const newId = 'tab_' + Math.random().toString(36).substring(2, 9);
    const newTab: PwaTab = {
      id: newId,
      title: meta.title,
      pathname: initialPath,
      search: '',
      type: meta.type,
      previewSubtitle: meta.previewSubtitle,
      updatedAt: Date.now()
    };

    setTabs(prev => [...prev, newTab]);
    setActiveTabId(newId);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate(initialPath, '');
    }
  }, []);

  // Close a specific tab
  const closeTab = useCallback((id: string, onNavigate?: (path: string, search?: string) => void) => {
    setTabs(prev => {
      const remaining = prev.filter(t => t.id !== id);
      if (remaining.length === 0) {
        const defaultTab: PwaTab = {
          id: 'tab_' + Math.random().toString(36).substring(2, 9),
          title: 'Inicio • Campus',
          pathname: '/',
          search: '',
          type: 'home',
          previewSubtitle: 'Explorar campus y rankings',
          updatedAt: Date.now()
        };
        setActiveTabId(defaultTab.id);
        if (onNavigate) onNavigate('/', '');
        return [defaultTab];
      }

      // If closing the active tab, switch to the last remaining tab
      if (id === activeTabId) {
        const nextActive = remaining[remaining.length - 1];
        setActiveTabId(nextActive.id);
        if (onNavigate) {
          onNavigate(nextActive.pathname, nextActive.search);
        }
      }

      return remaining;
    });
  }, [activeTabId]);

  // Close all tabs and reset to home
  const closeAllTabs = useCallback((onNavigate?: (path: string, search?: string) => void) => {
    const resetTab: PwaTab = {
      id: 'tab_' + Math.random().toString(36).substring(2, 9),
      title: 'Inicio • Campus',
      pathname: '/',
      search: '',
      type: 'home',
      previewSubtitle: 'Explorar campus y rankings',
      updatedAt: Date.now()
    };

    setTabs([resetTab]);
    setActiveTabId(resetTab.id);
    setIsTabsSwitcherOpen(false);

    if (onNavigate) {
      onNavigate('/', '');
    }
  }, []);

  const activeTab = tabs.find(t => t.id === activeTabId);

  return (
    <PwaTabsContext.Provider
      value={{
        isPwa,
        togglePwaSimulation,
        tabs,
        activeTabId,
        activeTab,
        isTabsSwitcherOpen,
        setIsTabsSwitcherOpen,
        switchTab,
        closeTab,
        closeAllTabs,
        createNewTab,
        syncCurrentRoute
      }}
    >
      {children}
    </PwaTabsContext.Provider>
  );
}

export function usePwaTabs() {
  const context = useContext(PwaTabsContext);
  if (!context) {
    throw new Error('usePwaTabs must be used within a PwaTabsProvider');
  }
  return context;
}
