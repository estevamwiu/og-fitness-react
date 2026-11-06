import React, { useState } from 'react';
import { Dumbbell, LockKeyhole, Mail, User, ShieldCheck, Eye, EyeOff, Hash, Delete } from 'lucide-react';
import { getSupabase, verifyStaffLogin, isSupabaseConfigured } from '../utils/supabase';
import { StaffMember } from '../types';
import { storage } from '../utils/storage';

interface LoginViewProps {
  onStaffLoggedIn?: (staff: StaffMember) => void;
  onManagerLoggedIn?: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onStaffLoggedIn }) => {
  const [loginMode, setLoginMode] = useState<'professor' | 'manager'>('professor');

  // Professor states
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);

  // Manager states
  const [managerEmail, setManagerEmail] = useState('');
  const [managerPassword, setManagerPassword] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick fill helper for testing
  const handleQuickFill = (user: string, pinCode: string) => {
    setUsername(user);
    setPin(pinCode);
    setError(null);
  };

  const handleKeypadPress = (val: string) => {
    setError(null);
    if (val === 'backspace') {
      setPin((prev) => prev.slice(0, -1));
    } else if (val === 'clear') {
      setPin('');
    } else if (pin.length < 6) {
      setPin((prev) => prev + val);
    }
  };

  const handlePinChange = (val: string) => {
    // Only numbers, max 6 digits
    const cleaned = val.replace(/\D/g, '').slice(0, 6);
    setPin(cleaned);
    setError(null);
  };

  // Submit Professor Login
  const handleProfessorSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    const cleanUser = username.trim().toLowerCase();
    if (!cleanUser) {
      setError('Informe o seu nome de usuário.');
      return;
    }

    if (pin.length !== 6) {
      setError('O PIN deve conter exatamente 6 números.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. First attempt verification via Supabase RPC/DB
      if (isSupabaseConfigured) {
        const result = await verifyStaffLogin(cleanUser, pin);
        if (result.success && result.staff) {
          if (onStaffLoggedIn) {
            onStaffLoggedIn(result.staff);
            return;
          }
        }
      }

      // 2. Check local fallback staff (useful before full DB migration or offline)
      const localStaff = storage.getStaff();
      const matched = localStaff.find(
        (s) =>
          s.active &&
          ((s.username && s.username.toLowerCase() === cleanUser) ||
            s.name.toLowerCase().includes(cleanUser) ||
            s.email?.toLowerCase().startsWith(cleanUser)) &&
          s.pin === pin
      );

      if (matched) {
        if (onStaffLoggedIn) {
          onStaffLoggedIn(matched);
          return;
        }
      }

      setError('Nome de usuário ou PIN de 6 dígitos incorreto.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submit Manager Login
  const handleManagerSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured) {
        throw new Error('Supabase não configurado. Verifique as variáveis de ambiente.');
      }

      const { error: signInError } = await getSupabase().auth.signInWithPassword({
        email: managerEmail.trim(),
        password: managerPassword,
      });

      if (signInError) throw signInError;
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Não foi possível entrar na conta de gestor.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-[#141414] border border-[#2a2a2a] rounded-2xl p-6 sm:p-8 space-y-6 shadow-2xl shadow-black/60">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#00F201] text-black flex items-center justify-center font-black text-xl shadow-lg shadow-[#00F201]/20">
            <Dumbbell className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">OG FITNESS</h1>
          <p className="text-xs text-[#777]">Sistema de Ponto Eletrônico & Fechamento de Horas</p>
        </div>

        {/* Login Type Switcher (Professor vs Gestor) */}
        <div className="grid grid-cols-2 p-1 bg-[#0d0d0d] rounded-xl border border-[#222]">
          <button
            type="button"
            onClick={() => {
              setLoginMode('professor');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMode === 'professor'
                ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/30 shadow'
                : 'text-[#777] hover:text-[#ccc]'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Professor</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setLoginMode('manager');
              setError(null);
            }}
            className={`flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-all ${
              loginMode === 'manager'
                ? 'bg-[#1a1a1a] text-[#00F201] border border-[#00F201]/30 shadow'
                : 'text-[#777] hover:text-[#ccc]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Gestor (2 Gestores)</span>
          </button>
        </div>

        {/* PROFESSOR LOGIN FORM */}
        {loginMode === 'professor' && (
          <form onSubmit={handleProfessorSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-medium text-[#aaa] flex items-center justify-between">
                <span>Nome de Usuário</span>
                <span className="text-[10px] text-[#555]">ex: carlos, mariana</span>
              </label>
              <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3.5 focus-within:border-[#00F201] transition-colors">
                <User className="w-4 h-4 text-[#777]" />
                <input
                  type="text"
                  autoComplete="username"
                  required
                  placeholder="Seu usuário cadastrado"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder-[#555] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs font-medium text-[#aaa]">
                <span>PIN de 6 Números</span>
                <button
                  type="button"
                  onClick={() => setShowKeypad(!showKeypad)}
                  className="text-[11px] text-[#00F201] hover:underline flex items-center gap-1"
                >
                  <Hash className="w-3 h-3" />
                  {showKeypad ? 'Ocultar teclado' : 'Teclado na tela'}
                </button>
              </div>

              <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3.5 focus-within:border-[#00F201] transition-colors">
                <LockKeyhole className="w-4 h-4 text-[#777]" />
                <input
                  type={showPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  placeholder="••••••"
                  value={pin}
                  onChange={(event) => handlePinChange(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white tracking-widest placeholder-[#555] outline-none font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-[#666] hover:text-[#aaa] p-1"
                  aria-label={showPin ? 'Ocultar PIN' : 'Mostrar PIN'}
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              {/* Visual 6-dot indicator */}
              <div className="flex justify-center gap-2 py-1.5">
                {[0, 1, 2, 3, 4, 5].map((idx) => (
                  <span
                    key={idx}
                    className={`w-2.5 h-2.5 rounded-full transition-all ${
                      idx < pin.length
                        ? 'bg-[#00F201] scale-110 shadow-sm shadow-[#00F201]'
                        : 'bg-[#222]'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Optional On-Screen Keypad for Reception Tablets */}
            {showKeypad && (
              <div className="grid grid-cols-3 gap-2 p-3 bg-[#0d0d0d] rounded-xl border border-[#222]">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    onClick={() => handleKeypadPress(digit)}
                    className="py-3 bg-[#161616] hover:bg-[#202020] active:scale-95 text-white font-mono font-bold text-base rounded-lg border border-[#2a2a2a] transition-all"
                  >
                    {digit}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => handleKeypadPress('clear')}
                  className="py-3 bg-[#1a1212] hover:bg-[#241616] text-[#ff7777] font-semibold text-xs rounded-lg border border-[#332222] transition-all"
                >
                  Limpar
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('0')}
                  className="py-3 bg-[#161616] hover:bg-[#202020] active:scale-95 text-white font-mono font-bold text-base rounded-lg border border-[#2a2a2a] transition-all"
                >
                  0
                </button>
                <button
                  type="button"
                  onClick={() => handleKeypadPress('backspace')}
                  className="py-3 bg-[#161616] hover:bg-[#202020] text-[#aaa] flex items-center justify-center rounded-lg border border-[#2a2a2a] transition-all"
                  aria-label="Apagar dígito"
                >
                  <Delete className="w-4 h-4" />
                </button>
              </div>
            )}

            {error && <p role="alert" className="text-xs text-[#ff7777] bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg p-2.5 text-center">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting || pin.length !== 6 || !username.trim()}
              className="w-full rounded-xl bg-[#00F201] hover:bg-[#00cc01] disabled:opacity-50 py-3 text-sm font-bold text-black shadow-lg shadow-[#00F201]/10 transition-all active:scale-[0.99]"
            >
              {isSubmitting ? 'Verificando...' : 'Entrar no Ponto'}
            </button>

            {/* Demo quick access buttons */}
            <div className="pt-2 border-t border-[#222] text-center space-y-1.5">
              <p className="text-[10px] text-[#666]">Contas de teste para professores:</p>
              <div className="flex flex-wrap justify-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => handleQuickFill('carlos', '123456')}
                  className="px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] text-[#aaa] border border-[#2a2a2a]"
                >
                  carlos / 123456
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('mariana', '234567')}
                  className="px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] text-[#aaa] border border-[#2a2a2a]"
                >
                  mariana / 234567
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickFill('rafael', '345678')}
                  className="px-2 py-1 rounded bg-[#1a1a1a] hover:bg-[#222] text-[#aaa] border border-[#2a2a2a]"
                >
                  rafael / 345678
                </button>
              </div>
            </div>
          </form>
        )}

        {/* GESTOR (MANAGER) LOGIN FORM */}
        {loginMode === 'manager' && (
          <form onSubmit={handleManagerSubmit} className="space-y-4">
            <div className="p-3 bg-[#0d0d0d] rounded-xl border border-[#222] text-[11px] text-[#888] space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-white">
                <ShieldCheck className="w-4 h-4 text-[#00F201]" />
                <span>Área Restrita aos 2 Gestores</span>
              </div>
              <p>
                Acesso com e-mail corporativo para conferência de relatórios, equipe, valores/hora e fechamento salarial mensal.
              </p>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#aaa]">E-mail do Gestor</label>
              <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3.5 focus-within:border-[#00F201] transition-colors">
                <Mail className="w-4 h-4 text-[#777]" />
                <input
                  type="email"
                  autoComplete="username"
                  required
                  placeholder="gestor@ogfitness.com.br"
                  value={managerEmail}
                  onChange={(event) => setManagerEmail(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder-[#555] outline-none"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-medium text-[#aaa]">Senha</label>
              <div className="flex items-center gap-2 bg-[#0d0d0d] border border-[#2a2a2a] rounded-xl px-3.5 focus-within:border-[#00F201] transition-colors">
                <LockKeyhole className="w-4 h-4 text-[#777]" />
                <input
                  type="password"
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  value={managerPassword}
                  onChange={(event) => setManagerPassword(event.target.value)}
                  className="w-full bg-transparent py-2.5 text-sm text-white placeholder-[#555] outline-none"
                />
              </div>
            </div>

            {error && <p role="alert" className="text-xs text-[#ff7777] bg-[#ff4444]/10 border border-[#ff4444]/20 rounded-lg p-2.5 text-center">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-[#00F201] hover:bg-[#00cc01] disabled:opacity-50 py-3 text-sm font-bold text-black shadow-lg shadow-[#00F201]/10 transition-all active:scale-[0.99]"
            >
              {isSubmitting ? 'Acessando Gestão...' : 'Entrar como Gestor'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
};
