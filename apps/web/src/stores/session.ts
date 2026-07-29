import { create } from 'zustand';

interface Session { email: string | null; setEmail: (e: string | null) => void; theme: 'dark' | 'light'; toggleTheme: () => void; }
export const useSession = create<Session>((set) => ({
  email: null,
  setEmail: (email) => set({ email }),
  theme: 'dark',
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
}));
