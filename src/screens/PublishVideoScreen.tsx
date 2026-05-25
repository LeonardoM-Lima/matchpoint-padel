import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CategoryPicker } from '../components/CategoryPicker';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { VideoUpload } from '../components/VideoUpload';
import { useAuth } from '../contexts/AuthContext';
import { publishVideo, type VideoCategory } from '../services/feed.service';

export function PublishVideoScreen() {
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<VideoCategory>('smash');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!profile || !user) {
      setError('Não conseguimos carregar seu perfil.');
      return;
    }

    if (!file) {
      setVideoError('Selecione um vídeo para publicar.');
      return;
    }

    setSaving(true);
    try {
      await publishVideo({
        authorUserId: user.id,
        authorProfileId: profile.id,
        file,
        title,
        category,
      });
      navigate('/feed', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Não foi possível enviar o vídeo. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300 hover:text-emerald-200"
            to="/feed"
          >
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-500 text-emerald-950 shadow-glow">
              <Icon name="upload" size={23} strokeWidth={2.4} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">
                Feed de jogadas
              </p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">
                Publicar vídeo
              </h1>
            </div>
          </div>
        </header>

        <form className="grid gap-4" onSubmit={handleSubmit}>
          <VideoUpload
            file={file}
            disabled={saving}
            error={videoError}
            onSelected={setFile}
            onError={setVideoError}
          />

          <label className="grid gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">
              Titulo
            </span>
            <input
              className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
              type="text"
              value={title}
              minLength={3}
              maxLength={80}
              disabled={saving}
              placeholder="Ex: Smash na parede lateral"
              onChange={(event) => setTitle(event.target.value)}
            />
          </label>

          <CategoryPicker value={category} disabled={saving} onChange={setCategory} />

          <p className="rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-3 text-xs leading-5 text-slate-400">
            Para melhor compatibilidade, use vídeos gravados pelo celular em MP4.
          </p>

          {error ? <ErrorBanner message={error} /> : null}

          <button
            className="btn-primary inline-flex min-h-[56px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60"
            type="submit"
            disabled={saving}
          >
            <Icon name="upload" size={20} />
            {saving ? 'Publicando...' : 'Publicar vídeo'}
          </button>
        </form>
      </section>
    </main>
  );
}
