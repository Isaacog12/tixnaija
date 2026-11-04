import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabase/client';
import type { Database } from '../supabase/types';

const TICKET_CACHE_PREFIX = '@my_tickets_cache:';

async function clearTicketCaches() {
  const keys = await AsyncStorage.getAllKeys();
  const ticketCacheKeys = keys.filter((key) => key.startsWith(TICKET_CACHE_PREFIX));
  await AsyncStorage.multiRemove(['@my_tickets_cache', ...ticketCacheKeys]);
}

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isOrganizer: boolean;
  isAdmin: boolean;
  isCustomerCare: boolean;
  isStaff: boolean;
  roles: string[];
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isCustomerCare, setIsCustomerCare] = useState(false);
  const [roles, setRoles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfileAndRole = useCallback(async (userId: string) => {
    try {
      const [profileRes, rolesRes] = await Promise.all([
        supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle(),
        supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', userId),
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
      }
      const fetchedRoles = (rolesRes.data ?? []).map((r: any) => r.role);
      setRoles(fetchedRoles);
      setIsAdmin(fetchedRoles.includes('admin'));
      setIsCustomerCare(fetchedRoles.includes('customer_care'));
    } catch (err) {
      console.warn('[AuthContext] Failed to load user profile or role:', err);
    }
  }, []);

  useEffect(() => {
    let isMounted = true;

    // Restore existing session on cold start
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfileAndRole(session.user.id).finally(() => {
          if (isMounted) setIsLoading(false);
        });
      } else {
        setIsLoading(false);
      }
    });

    // Listen to real-time auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!isMounted) return;
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        await fetchProfileAndRole(newSession.user.id);
      } else {
        setProfile(null);
        setIsAdmin(false);
        setIsCustomerCare(false);
        setRoles([]);
      }
      setIsLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfileAndRole]);

  const signOut = async () => {
    setIsLoading(true);
    try {
      await clearTicketCaches();
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setIsAdmin(false);
      setIsCustomerCare(false);
      setRoles([]);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshProfile = async () => {
    if (user?.id) {
      await fetchProfileAndRole(user.id);
    }
  };

  const isOrganizer = Boolean(profile?.is_organizer || roles.includes('organizer'));
  const isStaff = Boolean(isAdmin || isCustomerCare);

  const value: AuthContextValue = {
    session,
    user,
    profile,
    isOrganizer,
    isAdmin,
    isCustomerCare,
    isStaff,
    roles,
    isLoading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
