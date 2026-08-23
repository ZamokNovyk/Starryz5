'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  Sparkles, 
  Calculator, 
  Clock, 
  Calendar, 
  Plus, 
  Trash2, 
  Play, 
  Pause, 
  RotateCcw, 
  Save, 
  BookOpen, 
  Flame, 
  Award,
  BookMarked
} from 'lucide-react';

interface ToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Interfaces for Grade Calculator
interface GradeEntry {
  id: string;
  name: string;
  grade: number;
  weight: number;
}

// Interfaces for Scheduler
interface ClassEntry {
  id: string;
  day: string; // 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'
  time: string; // e.g. '08:00 - 10:00'
  course: string;
  classroom: string;
}

const DAYS_OF_WEEK = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];

export default function ToolsModal({ isOpen, onClose }: ToolsModalProps) {
  const [activeTab, setActiveTab] = useState<'calculator' | 'pomodoro' | 'schedule'>('calculator');

  // --- GRADE CALCULATOR STATE ---
  const [grades, setGrades] = useState<GradeEntry[]>([
    { id: '1', name: 'Examen Parcial', grade: 14, weight: 30 },
    { id: '2', name: 'Práctica 1', grade: 16, weight: 20 },
    { id: '3', name: 'Trabajo Final', grade: 12, weight: 30 },
  ]);
  const [newGradeName, setNewGradeName] = useState('');
  const [newGradeVal, setNewGradeVal] = useState<number | ''>('');
  const [newGradeWeight, setNewGradeWeight] = useState<number | ''>('');
  const [targetPassingGrade, setTargetPassingGrade] = useState<number>(11); // Peruvian scale standard for pedagogical is 11 or 13

  // Load Grades from LocalStorage
  useEffect(() => {
    if (isOpen) {
      const savedGrades = localStorage.getItem('starryz_tools_grades');
      if (savedGrades) {
        try {
          setGrades(JSON.parse(savedGrades));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isOpen]);

  // Save Grades to LocalStorage
  const saveGrades = (updatedGrades: GradeEntry[]) => {
    setGrades(updatedGrades);
    localStorage.setItem('starryz_tools_grades', JSON.stringify(updatedGrades));
  };

  const addGrade = () => {
    if (!newGradeName.trim() || newGradeVal === '' || newGradeWeight === '') return;
    const val = Number(newGradeVal);
    const weight = Number(newGradeWeight);
    if (val < 0 || val > 20 || weight <= 0 || weight > 100) return;

    const newEntry: GradeEntry = {
      id: Date.now().toString(),
      name: newGradeName.trim(),
      grade: val,
      weight: weight,
    };

    const updated = [...grades, newEntry];
    saveGrades(updated);
    setNewGradeName('');
    setNewGradeVal('');
    setNewGradeWeight('');
  };

  const removeGrade = (id: string) => {
    const updated = grades.filter(g => g.id !== id);
    saveGrades(updated);
  };

  // Calculations for Grades
  const totalWeight = grades.reduce((acc, curr) => acc + curr.weight, 0);
  const currentWeightedSum = grades.reduce((acc, curr) => acc + (curr.grade * curr.weight), 0);
  const currentAverage = totalWeight > 0 ? Number((currentWeightedSum / totalWeight).toFixed(2)) : 0;
  
  const remainingWeight = 100 - totalWeight;
  const neededScoreOnRemaining = remainingWeight > 0 
    ? Number((((targetPassingGrade * 100) - currentWeightedSum) / remainingWeight).toFixed(2))
    : 0;

  // --- POMODORO TIMER STATE ---
  const [pomoMinutes, setPomoMinutes] = useState(25);
  const [pomoSeconds, setPomoSeconds] = useState(0);
  const [pomoIsActive, setPomoIsActive] = useState(false);
  const [pomoMode, setPomoMode] = useState<'work' | 'break'>('work');
  const [completedSessions, setCompletedSessions] = useState(0);

  useEffect(() => {
    let interval: any = null;
    if (pomoIsActive) {
      interval = setInterval(() => {
        if (pomoSeconds > 0) {
          setPomoSeconds(pomoSeconds - 1);
        } else if (pomoSeconds === 0) {
          if (pomoMinutes === 0) {
            // Timer finished!
            try {
              // Sound warning using browser Audio API
              const context = new (window.AudioContext || (window as any).webkitAudioContext)();
              const osc = context.createOscillator();
              const gain = context.createGain();
              osc.connect(gain);
              gain.connect(context.destination);
              osc.type = 'sine';
              osc.frequency.setValueAtTime(880, context.currentTime); // A5 note
              gain.gain.setValueAtTime(0.2, context.currentTime);
              osc.start();
              osc.stop(context.currentTime + 0.5);
            } catch (e) {
              console.log('Audio context warning: ', e);
            }

            if (pomoMode === 'work') {
              setPomoMode('break');
              setPomoMinutes(5);
              setCompletedSessions(prev => prev + 1);
              alert('🚨 ¡Sesión de estudio completada! Tómate un respiro de 5 minutos.');
            } else {
              setPomoMode('work');
              setPomoMinutes(25);
              alert('✍️ ¡Tiempo de volver a estudiar! Concéntrate durante 25 minutos.');
            }
            setPomoIsActive(false);
          } else {
            setPomoMinutes(pomoMinutes - 1);
            setPomoSeconds(59);
          }
        }
      }, 1000);
    } else {
      clearInterval(interval);
    }
    return () => clearInterval(interval);
  }, [pomoIsActive, pomoMinutes, pomoSeconds, pomoMode]);

  const togglePomo = () => setPomoIsActive(!pomoIsActive);
  const resetPomo = () => {
    setPomoIsActive(false);
    setPomoMode('work');
    setPomoMinutes(25);
    setPomoSeconds(0);
  };

  // --- WEEKLY SCHEDULER STATE ---
  const [schedule, setSchedule] = useState<ClassEntry[]>([
    { id: 's1', day: 'Lunes', time: '08:00 - 10:00', course: 'Pedagogía General', classroom: 'Aula 302' },
    { id: 's2', day: 'Miércoles', time: '10:15 - 12:15', course: 'Psicología del Aprendizaje', classroom: 'Lab A' },
    { id: 's3', day: 'Viernes', time: '14:00 - 16:00', course: 'Didáctica de la Especialidad', classroom: 'Aula 104' },
  ]);
  const [schedDay, setSchedDay] = useState('Lunes');
  const [schedTime, setSchedTime] = useState('');
  const [schedCourse, setSchedCourse] = useState('');
  const [schedClassroom, setSchedClassroom] = useState('');

  // Load Schedule from LocalStorage
  useEffect(() => {
    if (isOpen) {
      const savedSched = localStorage.getItem('starryz_tools_schedule');
      if (savedSched) {
        try {
          setSchedule(JSON.parse(savedSched));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, [isOpen]);

  const saveSchedule = (updatedSched: ClassEntry[]) => {
    setSchedule(updatedSched);
    localStorage.setItem('starryz_tools_schedule', JSON.stringify(updatedSched));
  };

  const addClass = () => {
    if (!schedTime.trim() || !schedCourse.trim()) return;

    const newClass: ClassEntry = {
      id: Date.now().toString(),
      day: schedDay,
      time: schedTime.trim(),
      course: schedCourse.trim(),
      classroom: schedClassroom.trim() || 'Virtual / Por definir',
    };

    const updated = [...schedule, newClass];
    saveSchedule(updated);
    setSchedTime('');
    setSchedCourse('');
    setSchedClassroom('');
  };

  const removeClass = (id: string) => {
    const updated = schedule.filter(s => s.id !== id);
    saveSchedule(updated);
  };


  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl bg-[#0d0d0d] border border-[#eab308]/40 rounded-2xl shadow-[0_0_50px_rgba(234,179,8,0.25)] flex flex-col max-h-[85vh] overflow-hidden">
        
        {/* Glow corner background */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-[#eab308]/5 blur-3xl rounded-full pointer-events-none"></div>

        {/* Modal Header */}
        <div className="p-6 border-b border-zinc-800/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#eab308]/10 border border-[#eab308]/30 flex items-center justify-center text-[#eab308]">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] font-black text-[#eab308] uppercase tracking-widest block">Utilidades Campus</span>
              <h3 className="text-lg font-black text-white uppercase tracking-tight">HERRAMIENTAS ESTUDIANTILES</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full bg-[#151515] border border-[#ffffff10] text-zinc-400 hover:text-white hover:border-[#eab308]/60 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs switcher */}
        <div className="flex bg-[#070707] border-b border-zinc-800/60 p-1.5 gap-1 shrink-0">
          <button
            onClick={() => setActiveTab('calculator')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'calculator' 
                ? 'bg-[#eab308] text-black shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#121212]'
            }`}
          >
            <Calculator className="w-4 h-4" />
            <span>Notas & Promedios</span>
          </button>

          <button
            onClick={() => setActiveTab('pomodoro')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'pomodoro' 
                ? 'bg-[#eab308] text-black shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#121212]'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>Estudio Foco</span>
          </button>

          <button
            onClick={() => setActiveTab('schedule')}
            className={`flex-1 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === 'schedule' 
                ? 'bg-[#eab308] text-black shadow-md' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-[#121212]'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Mi Horario</span>
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* 1. CALCULADORA DE NOTAS */}
          {activeTab === 'calculator' && (
            <div className="space-y-6">
              <div className="bg-[#121316] border border-zinc-800/60 rounded-xl p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div>
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Mi Promedio Actual (0 a 20)</h4>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-black text-[#eab308]">{currentAverage}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-extrabold uppercase border ${
                      currentAverage >= targetPassingGrade 
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
                        : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                      {currentAverage >= targetPassingGrade ? 'Aprobado' : 'Desaprobado'}
                    </span>
                  </div>
                </div>

                <div className="h-px w-full md:h-10 md:w-px bg-zinc-800/80"></div>

                <div className="text-center md:text-left">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Peso Acumulado</h4>
                  <p className="text-sm font-extrabold mt-1 text-white">{totalWeight}% de 100%</p>
                </div>

                <div className="h-px w-full md:h-10 md:w-px bg-zinc-800/80"></div>

                <div className="text-right">
                  <span className="text-xs text-zinc-500 block">Nota aprobatoria</span>
                  <select 
                    value={targetPassingGrade} 
                    onChange={(e) => setTargetPassingGrade(Number(e.target.value))}
                    className="mt-1 bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-bold text-[#eab308] px-2 py-1 outline-none"
                  >
                    <option value={11}>Nota 11 (Mínima Pedagogía)</option>
                    <option value={10.5}>Nota 10.5 (Técnica)</option>
                    <option value={13}>Nota 13 (Universitaria)</option>
                    <option value={14}>Nota 14 (Exigente)</option>
                  </select>
                </div>
              </div>

              {/* LIST OF GRADES */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Notas Registradas</h4>
                {grades.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-zinc-800/80 rounded-xl bg-zinc-900/30 text-zinc-500 text-xs italic">
                    No has agregado ninguna nota aún. Utiliza el formulario inferior para agregar tus evaluaciones.
                  </div>
                ) : (
                  <div className="divide-y divide-zinc-800/60 border border-zinc-800/60 rounded-xl overflow-hidden bg-[#121316]">
                    {grades.map((g) => (
                      <div key={g.id} className="p-3 flex items-center justify-between text-xs hover:bg-[#16171d] transition-all">
                        <div className="flex items-center gap-3">
                          <span className="w-2 h-2 rounded-full bg-[#eab308]"></span>
                          <span className="font-extrabold text-white">{g.name}</span>
                        </div>
                        <div className="flex items-center gap-6">
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block">Peso</span>
                            <span className="font-semibold text-zinc-300">{g.weight}%</span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-zinc-500 block">Nota</span>
                            <span className="font-black text-[#eab308]">{g.grade}</span>
                          </div>
                          <button
                            onClick={() => removeGrade(g.id)}
                            className="p-1 text-zinc-500 hover:text-rose-400 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* ESTIMATION ADVICE */}
              {remainingWeight > 0 && (
                <div className="p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-[11px] text-amber-300 leading-relaxed flex items-center gap-2">
                  <Award className="w-4 h-4 shrink-0 text-[#eab308]" />
                  <span>
                    Te falta el <strong className="font-bold text-white">{remainingWeight}%</strong> de la nota. Necesitas un promedio de <strong className="font-bold text-white text-xs">{neededScoreOnRemaining > 0 ? neededScoreOnRemaining : 0}</strong> en las evaluaciones restantes para aprobar el curso con <strong className="font-bold text-white">{targetPassingGrade}</strong>.
                  </span>
                </div>
              )}

              {/* ADD GRADE FORM */}
              <div className="bg-[#121316]/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <span className="text-xs font-black text-white uppercase tracking-wider block">Agregar Evaluación</span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    placeholder="Ej. Tarea Académica 1"
                    value={newGradeName}
                    onChange={(e) => setNewGradeName(e.target.value)}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-medium"
                  />
                  <input
                    type="number"
                    min="0"
                    max="20"
                    placeholder="Nota (0 - 20)"
                    value={newGradeVal}
                    onChange={(e) => setNewGradeVal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-bold"
                  />
                  <input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Peso (1% - 100%)"
                    value={newGradeWeight}
                    onChange={(e) => setNewGradeWeight(e.target.value === '' ? '' : Number(e.target.value))}
                    className="bg-zinc-900/80 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-bold"
                  />
                </div>
                <button
                  onClick={addGrade}
                  className="w-full py-2 bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Registrar Nota</span>
                </button>
              </div>
            </div>
          )}

          {/* 2. POMODORO STUDY TIMER */}
          {activeTab === 'pomodoro' && (
            <div className="space-y-6 flex flex-col items-center">
              
              <div className="text-center max-w-sm">
                <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-full border ${
                  pomoMode === 'work' 
                    ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' 
                    : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                }`}>
                  {pomoMode === 'work' ? '✍️ ESTUDIANDO FOCUS' : '🌸 RECREO REFRESCANTE'}
                </span>
                <p className="text-zinc-500 text-xs mt-2">
                  La técnica Pomodoro te ayuda a estudiar 25 min seguidos con 5 min de descanso. ¡Sube tu rendimiento!
                </p>
              </div>

              {/* TIMER DISPLAY */}
              <div className="relative w-44 h-44 rounded-full border-4 border-zinc-800 flex flex-col items-center justify-center bg-zinc-900/40 shadow-[0_0_35px_rgba(234,179,8,0.05)] ring-4 ring-black">
                <span className="text-4xl font-black text-white tracking-tight">
                  {String(pomoMinutes).padStart(2, '0')}:{String(pomoSeconds).padStart(2, '0')}
                </span>
                <span className="text-[9px] text-zinc-500 font-extrabold uppercase tracking-widest mt-1">
                  {pomoIsActive ? 'CONCENTRADO' : 'PAUSADO'}
                </span>
              </div>

              {/* CONTROLS */}
              <div className="flex gap-3">
                <button
                  onClick={togglePomo}
                  className={`px-6 py-2.5 rounded-xl font-black text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer ${
                    pomoIsActive 
                      ? 'bg-zinc-800 hover:bg-zinc-700 text-white' 
                      : 'bg-[#eab308] hover:bg-[#d9a307] text-black shadow-md'
                  }`}
                >
                  {pomoIsActive ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  <span>{pomoIsActive ? 'Pausar' : 'Comenzar'}</span>
                </button>

                <button
                  onClick={resetPomo}
                  className="px-6 py-2.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 rounded-xl font-extrabold text-xs uppercase flex items-center gap-1.5 transition-all cursor-pointer text-zinc-300"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Reiniciar</span>
                </button>
              </div>

              {/* POMODORO STATS */}
              <div className="w-full grid grid-cols-2 gap-3 bg-[#121316] p-4 rounded-xl border border-zinc-800/60 max-w-sm">
                <div className="text-center">
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Sesiones completadas</span>
                  <div className="flex items-center justify-center gap-1 mt-1 text-[#eab308] font-bold">
                    <Flame className="w-4 h-4 fill-[#eab308]/20" />
                    <span>{completedSessions}</span>
                  </div>
                </div>
                <div className="text-center border-l border-zinc-800/80">
                  <span className="text-[10px] text-zinc-500 uppercase font-black block">Tiempo de estudio</span>
                  <span className="text-xs font-bold text-white mt-1 block">{completedSessions * 25} min acumulados</span>
                </div>
              </div>

            </div>
          )}

          {/* 3. WEEKLY CLASS SCHEDULER */}
          {activeTab === 'schedule' && (
            <div className="space-y-6">
              
              {/* CURRENT SCHEDULE TABLE BY DAYS */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-zinc-400 uppercase tracking-wider">Mi Horario Semanal</h4>
                  <span className="text-[10px] text-zinc-500 font-semibold italic">Guardado automáticamente en este dispositivo</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayClasses = schedule.filter(s => s.day === day);
                    return (
                      <div key={day} className="bg-[#121316] border border-zinc-800/60 rounded-xl p-3 flex flex-col min-h-[140px]">
                        <span className="text-[10px] font-black text-[#eab308] uppercase tracking-wider border-b border-zinc-800 pb-1.5 block">
                          {day}
                        </span>

                        <div className="flex-1 space-y-2 mt-2">
                          {dayClasses.length === 0 ? (
                            <span className="text-[10px] text-zinc-600 block text-center py-4 italic">Libre</span>
                          ) : (
                            dayClasses.map((cl) => (
                              <div key={cl.id} className="p-1.5 rounded bg-zinc-900/60 border border-zinc-800 text-[10px] relative group hover:border-[#eab308]/30">
                                <p className="font-extrabold text-white leading-tight truncate pr-4">{cl.course}</p>
                                <p className="text-zinc-400 font-medium leading-normal mt-0.5">{cl.time}</p>
                                <p className="text-[#eab308]/90 font-bold leading-normal mt-0.5">{cl.classroom}</p>
                                <button
                                  onClick={() => removeClass(cl.id)}
                                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-0.5 rounded text-rose-500 hover:bg-rose-500/10 transition-all cursor-pointer"
                                  title="Eliminar clase"
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ADD CLASS FORM */}
              <div className="bg-[#121316]/50 border border-zinc-800/80 rounded-xl p-4 space-y-3">
                <span className="text-xs font-black text-white uppercase tracking-wider block">Agregar Clase al Horario</span>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold block mb-1">Día de la semana</span>
                    <select
                      value={schedDay}
                      onChange={(e) => setSchedDay(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg text-xs font-semibold text-white px-3 py-2 outline-none"
                    >
                      {DAYS_OF_WEEK.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold block mb-1">Hora (Ej. 08:00 - 10:00)</span>
                    <input
                      type="text"
                      placeholder="Ej. 10:30 - 12:30"
                      value={schedTime}
                      onChange={(e) => setSchedTime(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-medium"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold block mb-1">Curso / Asignatura</span>
                    <input
                      type="text"
                      placeholder="Ej. Álgebra lineal"
                      value={schedCourse}
                      onChange={(e) => setSchedCourse(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-medium"
                    />
                  </div>

                  <div>
                    <span className="text-[9px] text-zinc-500 font-bold block mb-1">Aula / Salón (Opcional)</span>
                    <input
                      type="text"
                      placeholder="Ej. Aula 402"
                      value={schedClassroom}
                      onChange={(e) => setSchedClassroom(e.target.value)}
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-[#eab308]/50 placeholder:text-zinc-600 font-medium"
                    />
                  </div>
                </div>

                <button
                  onClick={addClass}
                  className="w-full py-2 bg-[#eab308] hover:bg-[#d9a307] text-black font-extrabold text-xs uppercase rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>Agregar Clase</span>
                </button>
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="p-4 bg-[#070707] border-t border-zinc-800/80 text-center text-[10px] text-zinc-500 flex items-center justify-center gap-1.5 shrink-0">
          <BookMarked className="w-3.5 h-3.5 text-[#eab308]" />
          <span>Starryz 5 herramientas - Diseñadas para impulsar tu vida académica.</span>
        </div>

      </div>
    </div>
  );
}
