import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { auth } from '@/src/lib/firebase';
import { AuthUser, loginWithGoogle, loginAnonymously, logout, syncUserWithSupabase, linkAnonymousWithGoogle } from '@/src/lib/auth';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isAnonymous: boolean;
  loginWithGoogle: () => Promise<AuthUser>;
  loginAnonymously: () => Promise<AuthUser>;
  logout: () => Promise<void>;
  linkWithGoogle: () => Promise<AuthUser>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseUser | null) => {
      try {
        setLoading(true);
        if (firebaseUser) {
          const authUser: AuthUser = {
            uid: firebaseUser.uid,
            displayName: firebaseUser.displayName || (firebaseUser.isAnonymous ? 'Usuario Anónimo' : null),
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL,
            isAnonymous: firebaseUser.isAnonymous,
          };
          setUser(authUser);
          
          // Sincroniza automáticamente con Supabase al detectar inicio de sesión
          try {
            await syncUserWithSupabase(authUser);
          } catch (syncError: any) {
            console.warn('Aviso de sincronización automática:', syncError?.message || syncError);
          }
        } else {
          setUser(null);
        }
      } catch (err) {
        console.error('Error al manejar el cambio de autenticación de Firebase:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLoginWithGoogle = async () => {
    setLoading(true);
    try {
      return await loginWithGoogle();
    } finally {
      setLoading(false);
    }
  };

  const handleLoginAnonymously = async () => {
    setLoading(true);
    try {
      return await loginAnonymously();
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLoading(true);
    try {
      await logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const handleLinkWithGoogle = async () => {
    setLoading(true);
    try {
      const linkedUser = await linkAnonymousWithGoogle();
      setUser(linkedUser);
      return linkedUser;
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAnonymous: user?.isAnonymous || false,
        loginWithGoogle: handleLoginWithGoogle,
        loginAnonymously: handleLoginAnonymously,
        logout: handleLogout,
        linkWithGoogle: handleLinkWithGoogle,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};
