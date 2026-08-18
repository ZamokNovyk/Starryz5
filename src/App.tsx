import React, { useState, useEffect } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import RegisteredInstitutions from '@/components/RegisteredInstitutions';
import Footer from '@/components/Footer';
import InstallAppModal from '@/components/Modals/InstallAppModal';
import JoinModal from '@/components/Modals/JoinModal';
import ProfileModal from '@/components/Modals/ProfileModal';
import InstitutionModal from '@/components/Modals/InstitutionModal';
import SupabaseStatusBadge from '@/components/SupabaseStatusBadge';
import MyProfile from '@/components/MyProfile';
import CreateCenterModal from '@/components/Modals/CreateCenterModal';
import SearchResultsView from '@/components/SearchResultsView';
import EducationalCenterProfileView from '@/components/EducationalCenterProfileView';
import ProfessorProfile from '@/src/pages/ProfessorProfile';
import { useAuth } from '@/src/context/AuthContext';
import { LayoutGrid, User, Plus } from 'lucide-react';
import { Institution, Student } from '@/lib/mockData';
import { getEducationalCenters, EducationalCenter } from '@/src/lib/centers';

function generateAcronym(name: string): string {
  const cleanWords = name
    .trim()
    .split(/\s+/)
    .filter(word => {
      const lower = word.toLowerCase();
      return lower.length > 2 && !['de', 'del', 'la', 'las', 'el', 'los', 'en', 'y', 'con', 'para', 'por'].includes(lower);
    });

  if (cleanWords.length === 0) return name.substring(0, 4).toUpperCase();
  if (cleanWords.length === 1) return cleanWords[0].substring(0, 4).toUpperCase();
  return cleanWords.map(w => w[0]).join('').toUpperCase().substring(0, 6);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/[^a-z0-9]/g, '.') // replace non-alphanumeric with dot
    .replace(/\.+/g, '.') // collapse multiple dots
    .replace(/^\.|\.$/g, ''); // trim dots from start/end
}

function matchSlug(name: string, targetSlug: string): boolean {
  const slug1 = toSlug(name);
  const slug2 = targetSlug.toLowerCase().trim();
  if (slug1 === slug2) return true;
  return slug1.replace(/\./g, '') === slug2.replace(/\./g, '');
}

export default function App() {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [autoNavigateToProfile, setAutoNavigateToProfile] = useState(false);

  // Router state
  const [route, setRoute] = useState({
    pathname: typeof window !== 'undefined' ? window.location.pathname : '/',
    search: typeof window !== 'undefined' ? window.location.search : '',
  });

  // DB Centers state
  const [dbCenters, setDbCenters] = useState<EducationalCenter[]>([]);
  const [dbCentersLoading, setDbCentersLoading] = useState(false);

  // Modals state
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [createCenterModalOpen, setCreateCenterModalOpen] = useState(false);
  const [institutionsRefreshKey, setInstitutionsRefreshKey] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  // Sync route popstate events
  useEffect(() => {
    const handlePopState = () => {
      setRoute({
        pathname: window.location.pathname,
        search: window.location.search,
      });
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigate = (pathname: string, search: string = '') => {
    window.history.pushState(null, '', pathname + search);
    setRoute({ pathname, search });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Fetch educational centers globally
  useEffect(() => {
    async function loadCenters() {
      try {
        setDbCentersLoading(true);
        const data = await getEducationalCenters();
        setDbCenters(data);
      } catch (err) {
        console.error('Error al cargar centros de Supabase en App:', err);
      } finally {
        setDbCentersLoading(false);
      }
    }
    loadCenters();
  }, [institutionsRefreshKey]);

  // Map centers to Institution type
  const mappedDbCenters: Institution[] = dbCenters.map(center => {
    const category: 'Universidad' | 'Instituto' | 'Colegio' = 
      center.type === 'colegio' 
        ? 'Colegio' 
        : center.type === 'instituto' 
          ? 'Instituto' 
          : 'Universidad';

    const fallbackImages = {
      'Colegio': 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?q=80&w=800&auto=format&fit=crop',
      'Instituto': 'https://images.unsplash.com/photo-1562774053-701939374585?q=80&w=800&auto=format&fit=crop',
      'Universidad': 'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?q=80&w=800&auto=format&fit=crop'
    };

    return {
      id: center.id,
      name: center.name,
      acronym: generateAcronym(center.name),
      category,
      campus: 'Sede Principal',
      city: 'Registrado por Alumno',
      studentsCount: 1,
      popularityScore: 7.0,
      verified: false,
      image: center.profile_photo_url || fallbackImages[category],
      topStudent: 'Sin líder',
    };
  });

  const allInstitutions = mappedDbCenters;

  // Auto-navigate to profile when user logs in if they previously clicked "Perfil"
  useEffect(() => {
    if (user && autoNavigateToProfile) {
      navigate('/perfil');
      setAutoNavigateToProfile(false);
    }
  }, [user, autoNavigateToProfile]);

  // Sync searchQuery from URL params if present
  useEffect(() => {
    const searchParams = new URLSearchParams(route.search);
    const q = searchParams.get('q');
    if (q) {
      setSearchQuery(q);
    } else if (route.pathname === '/') {
      setSearchQuery('');
    }
  }, [route]);

  const handleProfileTabClick = () => {
    if (user) {
      navigate('/perfil');
    } else {
      setJoinModalOpen(true);
      setAutoNavigateToProfile(true);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate('/search', `?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      const element = document.getElementById('seccion-resultados');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const handleSelectInstitution = (inst: Institution) => {
    navigate(`/educational_centers/${toSlug(inst.name)}`);
  };

  // Route matches
  const isProfileRoute = route.pathname.startsWith('/educational_centers/');
  const profileSlug = isProfileRoute ? route.pathname.replace('/educational_centers/', '') : '';
  const currentProfileInstitution = isProfileRoute
    ? allInstitutions.find(inst => matchSlug(inst.name, profileSlug))
    : null;

  const isProfessorRoute = route.pathname.startsWith('/profesores/');
  const professorSlug = isProfessorRoute ? route.pathname.replace('/profesores/', '') : '';

  const isUserProfileRoute = route.pathname.startsWith('/perfil/');
  const userProfileUid = isUserProfileRoute ? route.pathname.replace('/perfil/', '') : '';

  const isSearchRoute = route.pathname === '/search' || (route.pathname === '/' && new URLSearchParams(route.search).has('q'));
  const currentQuery = new URLSearchParams(route.search).get('q') || searchQuery;

  const searchResults = allInstitutions.filter(inst => {
    if (!currentQuery) return true;
    return (
      inst.name.toLowerCase().includes(currentQuery.toLowerCase()) ||
      inst.acronym.toLowerCase().includes(currentQuery.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-[#eab308] selection:text-black">
      
      {/* 1. Header (Barra de Navegación) */}
      <Header
        onOpenInstallModal={() => setInstallModalOpen(true)}
        onOpenJoinModal={() => setJoinModalOpen(true)}
        onGoToProfile={handleProfileTabClick}
        onGoToHome={() => navigate('/')}
        onOpenCreateCenterModal={() => setCreateCenterModalOpen(true)}
      />

      {/* 2. Main Content Area according to Route */}
      <main className="flex-1 pb-28">
        {isProfessorRoute ? (
          <ProfessorProfile
            slug={professorSlug}
            onBack={() => {
              if (window.history.length > 1) {
                window.history.back();
              } else {
                navigate('/');
              }
            }}
            onRequireAuth={() => setJoinModalOpen(true)}
          />
        ) : isProfileRoute ? (
          currentProfileInstitution ? (
            <EducationalCenterProfileView
              institution={currentProfileInstitution}
              onBack={() => navigate('/')}
              onSelectProfessor={(slug) => navigate(`/profesores/${slug}`)}
            />
          ) : (
            <div className="max-w-md mx-auto py-24 text-center space-y-4">
              <div className="text-zinc-500 font-black text-xl uppercase">Institución no encontrada</div>
              <p className="text-zinc-400 text-xs">El centro educativo solicitado no existe o no se encuentra registrado en nuestra base de datos.</p>
              <button
                onClick={() => navigate('/')}
                className="px-6 py-2.5 rounded-xl bg-[#eab308] text-black font-extrabold text-xs uppercase"
              >
                Volver al Inicio
              </button>
            </div>
          )
        ) : route.pathname === '/perfil' || isUserProfileRoute ? (
          <MyProfile uid={userProfileUid} onBackToHome={() => navigate('/')} />
        ) : isSearchRoute ? (
          <SearchResultsView
            query={currentQuery}
            results={searchResults}
            onSelectInstitution={handleSelectInstitution}
            onBack={() => navigate('/')}
          />
        ) : (
          <>
            <HeroSection
              searchQuery={searchQuery}
              setSearchQuery={setSearchQuery}
              onSearchSubmit={handleSearchSubmit}
            />

            <div id="seccion-resultados">
              {/* 3. Secciones UI Inferiores */}
              <RegisteredInstitutions
                onSelectInstitution={handleSelectInstitution}
                searchQuery={searchQuery}
                refreshKey={institutionsRefreshKey}
                dbCenters={dbCenters}
                loading={dbCentersLoading}
              />
            </div>
          </>
        )}
      </main>

      {/* Footer */}
      <Footer />

      {/* Floating Bottom Navigation */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0d0d0d]/95 backdrop-blur-md border border-[#ffffff15] rounded-full p-2 flex items-center gap-1.5 shadow-[0_12px_45px_rgba(0,0,0,0.85)] ring-1 ring-white/5">
        <button
          onClick={() => {
            navigate('/');
          }}
          className={`px-6 py-2.5 rounded-full flex items-center gap-2.5 text-xs font-black transition-all duration-300 cursor-pointer ${
            route.pathname === '/' || isSearchRoute || isProfileRoute || isProfessorRoute
              ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>EXPLORAR</span>
        </button>
        
        <button
          onClick={handleProfileTabClick}
          className={`px-6 py-2.5 rounded-full flex items-center gap-2.5 text-xs font-black transition-all duration-300 cursor-pointer ${
            route.pathname === '/perfil' || isUserProfileRoute
              ? 'bg-[#eab308] text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <User className="w-4 h-4" />
          <span>PERFIL DB</span>
        </button>
      </div>

      {/* Botón flotante para crear centro (Exclusivo de la pantalla principal) */}
      {route.pathname === '/' && (
        <button
          onClick={() => setCreateCenterModalOpen(true)}
          className="fixed bottom-24 right-6 sm:right-8 z-40 w-14 h-14 bg-[#eab308] text-black rounded-2xl flex items-center justify-center shadow-[0_4px_25px_rgba(234,179,8,0.45)] hover:scale-105 active:scale-95 transition-all cursor-pointer border-none"
          title="Crear Centro Educativo"
        >
          <Plus className="w-6 h-6 stroke-[3]" />
        </button>
      )}

      {/* MODALS */}
      <InstallAppModal
        isOpen={installModalOpen}
        onClose={() => setInstallModalOpen(false)}
      />

      <JoinModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
      />

      <ProfileModal
        student={selectedStudent}
        onClose={() => setSelectedStudent(null)}
      />

      <InstitutionModal
        institution={selectedInstitution}
        onClose={() => setSelectedInstitution(null)}
      />

      <CreateCenterModal
        isOpen={createCenterModalOpen}
        onClose={() => setCreateCenterModalOpen(false)}
        onSuccess={() => setInstitutionsRefreshKey(prev => prev + 1)}
      />

      {/* Technical integration badge */}
      <SupabaseStatusBadge />
    </div>
  );
}
