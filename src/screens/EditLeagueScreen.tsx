import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ImageUpload } from '../components/ImageUpload';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useLeague } from '../hooks/useLeague';
import { supabase } from '../lib/supabase';
import { leagueService } from '../services/league.service';

export function EditLeagueScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { detail, loading, error } = useLeague(id);
  const [name, setName] = useState('');
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const league = detail?.league;
  const currentCoverUrl = useMemo(() => {
    if (!league?.coverUrl) return null;
    return supabase.storage.from('league-covers').getPublicUrl(league.coverUrl).data.publicUrl;
  }, [league?.coverUrl]);

  useEffect(() => {
    if (league) setName(league.name);
  }, [league]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !league) return;

    const trimmed = name.trim();
    if (trimmed.length < 3 || trimmed.length > 40) {
      setSaveError('Informe um nome para a liga');
      return;
    }

    setSaving(true);
    setSaveError(null);

    try {
      await leagueService.updateLeague(id, { name: trimmed });
      if (coverFile) await leagueService.uploadCover(id, coverFile);
      navigate(`/leagues/${id}`);
    } catch (nextError) {
      setSaveError(nextError instanceof Error ? nextError.message : 'Nao foi possivel salvar a liga.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to={id ? `/leagues/${id}` : '/leagues'}>
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
              Liga privada
            </p>
            <h1 className="font-display text-3xl font-extrabold text-slate-50">Editar liga</h1>
          </div>
        </header>

        {loading ? <ScreenSkeleton rows={4} /> : null}
        {error ? <ErrorBanner message={error} /> : null}

        {!loading && detail && !detail.permissions.canEdit ? (
          <ErrorBanner message="Apenas o dono da liga pode realizar esta acao" />
        ) : null}

        {!loading && league && detail?.permissions.canEdit ? (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
                Nome da liga
              </span>
              <input
                className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
                value={name}
                maxLength={40}
                disabled={saving}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <ImageUpload
              label="Capa da liga"
              currentUrl={currentCoverUrl}
              disabled={saving}
              onFileSelected={setCoverFile}
            />

            {saveError ? <ErrorBanner message={saveError} /> : null}

            <div className="grid grid-cols-2 gap-3">
              <Link
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-700 px-4 font-bold text-slate-200"
                to={`/leagues/${league.id}`}
              >
                Cancelar
              </Link>
              <button className="btn-primary inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60" disabled={saving} type="submit">
                <Icon name="check" size={18} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : null}
      </section>
    </main>
  );
}
