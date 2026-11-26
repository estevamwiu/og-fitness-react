import { useEffect, useState, type FormEvent } from 'react';
import { ShieldCheck } from 'lucide-react';
import { getSupabase } from '../utils/supabase';

interface ManagerMfaViewProps {
  onSignOut: () => Promise<void>;
}

type FactorOption = { id: string; label: string };
type Enrollment = { qrCode: string; secret: string };

export function ManagerMfaView({ onSignOut }: ManagerMfaViewProps) {
  const [factors, setFactors] = useState<FactorOption[] | null>(null);
  const [factorId, setFactorId] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const { data, error } = await getSupabase().auth.mfa.listFactors();
        if (error) throw error;
        if (!active) return;
        const options = data.totp.map((factor, index) => ({
          id: factor.id,
          label: factor.friendly_name || `Autenticador ${index + 1}`,
        }));
        setFactors(options);
        setFactorId(options[0]?.id ?? '');
      } catch {
        if (active) setError('Não foi possível carregar os autenticadores. Tente novamente.');
      }
    })();
    return () => { active = false; };
  }, [attempt]);

  const startEnrollment = async () => {
    setBusy(true);
    setError(null);
    try {
      const mfa = getSupabase().auth.mfa;
      const { data: existing, error: listError } = await mfa.listFactors();
      if (listError) throw listError;
      if (existing.totp.length > 0) {
        setFactors(null);
        setAttempt((value) => value + 1);
        return;
      }
      for (const factor of existing.all) {
        if (factor.factor_type !== 'totp' || factor.status !== 'unverified') continue;
        const { error } = await mfa.unenroll({ factorId: factor.id });
        if (error) throw error;
      }
      const { data, error } = await mfa.enroll({ factorType: 'totp', issuer: 'OG Fitness' });
      if (error) throw error;
      setEnrollment({ qrCode: data.totp.qr_code, secret: data.totp.secret });
      setFactorId(data.id);
    } catch {
      setError('Não foi possível configurar o autenticador. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };

  const verifyCode = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy || code.length !== 6 || !factorId) return;
    setBusy(true);
    setError(null);
    try {
      const { error } = await getSupabase().auth.mfa.challengeAndVerify({ factorId, code });
      if (error) throw error;
    } catch {
      setError('Não foi possível validar o código. Confira o código atual e tente novamente.');
      setCode('');
    } finally {
      setBusy(false);
    }
  };

  const buttonClass = 'rounded-xl bg-[#00F201] px-4 py-2 font-semibold text-black disabled:opacity-60';

  return (
    <main className="grid min-h-screen place-items-center bg-[#0a0a0a] p-4 text-[#e0e0e0]">
      <section className="w-full max-w-md space-y-4 rounded-2xl border border-[#2a2a2a] bg-[#141414] p-6">
        <h1 className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="size-5 text-[#00F201]" aria-hidden="true" />
          Verificação em duas etapas
        </h1>

        {factors === null && !error && <p role="status">Carregando autenticadores...</p>}
        {factors === null && error && (
          <button type="button" className={buttonClass} onClick={() => {
            setError(null);
            setAttempt((value) => value + 1);
          }}>Tentar novamente</button>
        )}
        {factors?.length === 0 && !enrollment && (
          <>
            <p>Configure um aplicativo autenticador para acessar o painel do gestor.</p>
            <button type="button" className={buttonClass} disabled={busy} onClick={startEnrollment}>
              {busy ? 'Configurando...' : 'Configurar autenticador'}
            </button>
          </>
        )}
        {enrollment && (
          <div className="space-y-2">
            <p>Escaneie o QR code com seu aplicativo autenticador ou insira a chave manualmente.</p>
            <img src={enrollment.qrCode} alt="QR code do aplicativo autenticador" className="mx-auto size-44 rounded-lg bg-white p-2" />
            <details className="text-sm">
              <summary>Mostrar chave de configuração</summary>
              <code className="break-all">{enrollment.secret}</code>
            </details>
          </div>
        )}
        {factorId && (
          <form onSubmit={verifyCode} className="space-y-3">
            {factors && factors.length > 1 && (
              <label className="block">
                Aplicativo autenticador
                <select className="block w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-2"
                  value={factorId} disabled={busy} onChange={(event) => {
                    setFactorId(event.target.value);
                    setCode('');
                    setError(null);
                  }}>
                  {factors.map((factor) => <option key={factor.id} value={factor.id}>{factor.label}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              Código de seis dígitos
              <input className="mt-1 block w-full rounded-lg border border-[#2a2a2a] bg-[#0d0d0d] p-2 font-mono"
                inputMode="numeric" autoComplete="one-time-code" maxLength={6}
                value={code} disabled={busy} onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))} />
            </label>
            <button type="submit" className={buttonClass} disabled={busy || code.length !== 6}>
              {busy ? 'Verificando...' : 'Confirmar código'}
            </button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-[#ff7777]">{error}</p>}
        <button type="button" className="text-sm underline" onClick={onSignOut} disabled={busy}>Voltar ao login</button>
      </section>
    </main>
  );
}
