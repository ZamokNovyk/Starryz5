import React, { useState } from 'react';
import Header from '@/components/Header';
import HeroSection from '@/components/HeroSection';
import RegisteredInstitutions from '@/components/RegisteredInstitutions';
import PopularCampus from '@/components/PopularCampus';
import Footer from '@/components/Footer';
import InstallAppModal from '@/components/Modals/InstallAppModal';
import JoinModal from '@/components/Modals/JoinModal';
import ProfileModal from '@/components/Modals/ProfileModal';
import InstitutionModal from '@/components/Modals/InstitutionModal';
import SupabaseStatusBadge from '@/components/SupabaseStatusBadge';
import { Institution, Student } from '@/lib/mockData';

export default function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFilter, setQuickFilter] = useState('all');

  // Modals state
  const [installModalOpen, setInstallModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [selectedInstitution, setSelectedInstitution] = useState<Institution | null>(null);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const element = document.getElementById('seccion-resultados');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-zinc-100 flex flex-col font-sans selection:bg-[#eab308] selection:text-black">
      
      {/* 1. Header (Barra de Navegación) */}
      <Header
        onOpenInstallModal={() => setInstallModalOpen(true)}
        onOpenJoinModal={() => setJoinModalOpen(true)}
      />

      {/* 2. Hero Section (Sección Principal Centrada) */}
      <main className="flex-1">
        <HeroSection
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          onSearchSubmit={handleSearchSubmit}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
        />

        <div id="seccion-resultados">
          {/* 3. Secciones UI Inferiores */}
          {(quickFilter === 'all' || quickFilter === 'instituciones') && (
            <RegisteredInstitutions
              onSelectInstitution={(inst) => setSelectedInstitution(inst)}
              searchQuery={searchQuery}
            />
          )}

          {(quickFilter === 'all' || quickFilter === 'alumnos' || quickFilter === 'tendencias') && (
            <PopularCampus
              onSelectStudent={(student) => setSelectedStudent(student)}
              searchQuery={searchQuery}
            />
          )}
        </div>
      </main>

      {/* Footer */}
      <Footer />

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

      {/* Technical integration badge */}
      <SupabaseStatusBadge />
    </div>
  );
}
