import React, { useState } from 'react';
import { Dumbbell, LockKeyhole, Mail } from 'lucide-react';
import { getSupabase } from '../utils/supabase';

export const LoginView: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="w-full max-w-sm bg-[#141414] border border-[#2a2a2a] rounded-2xl p-7 space-y-5">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 mx-auto rounded-xl bg-[#00F201] text-black flex items-center justify-center">
            <Dumbbell className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-white">OG FITNESS</h1>
          <p className="text-sm text-[#777]">Entre com seu e-mail e senha</p>
        </div>

        <label className="block text-xs text-[#aaa] space-y-1.5">
          <span>E-mail</span>
          <span className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3">
            <Mail className="w-4 h-4 text-[#777]" />
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full bg-transparent py-2.5 text-white outline-none"
            />
          </span>
        </label>

        <label className="block text-xs text-[#aaa] space-y-1.5">
          <span>Senha</span>
          <span className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-lg px-3">
            <LockKeyhole className="w-4 h-4 text-[#777]" />
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full bg-transparent py-2.5 text-white outline-none"
            />
          </span>
        </label>

        {error && <p role="alert" className="text-sm text-[#ff7777]">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-[#00F201] hover:bg-[#00cc01] disabled:opacity-50 py-2.5 text-sm font-bold text-black"
        >
          {isSubmitting ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </main>
  );
};
