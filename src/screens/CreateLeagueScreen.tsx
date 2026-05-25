import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ImageUpload } from '../components/ImageUpload';
import { leagueService } from '../services/league.service';

export function CreateLeagueScreen() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      setError('Informe um nome para a liga');
      return;
    }

    setSaving(true);
    try {
      const leagueId = await leagueService.createLeague({ name: trimmed });
      if (coverFile) await leagueService.uploadCover(leagueId, coverFile);
      navigate(`/leagues/${leagueId}`);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel criar a liga.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to="/leagues">
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <h1 className="font-display text-3xl font-extrabold text-slate-50">Criar liga</h1>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">Nome da liga</span>
            <input
              className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
              value={name}
              maxLength={40}
              disabled={saving}
              onChange={(event) => setName(event.target.value)}
            />
          </label>

          <ImageUpload label="Capa da liga" disabled={saving} onFileSelected={setCoverFile} />

          {error ? <ErrorBanner message={error} /> : null}

          <button className="btn-primary inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60" disabled={saving} type="submit">
            <Icon name="check" size={20} />
            {saving ? 'Criando...' : 'Criar liga'}
          </button>
        </form>
      </section>
    </main>
  );
}
