import { FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { PlayerCategory } from '../../specs/002-perfil-e-ligas/contracts/types';
import { CategoryBadge, playerCategoryOptions } from '../components/CategoryBadge';
import { ErrorBanner } from '../components/ErrorBanner';
import { Icon } from '../components/Icon';
import { ImageUpload } from '../components/ImageUpload';
import { ScreenSkeleton } from '../components/ScreenSkeleton';
import { useAuth } from '../contexts/AuthContext';
import { useProfile } from '../hooks/useProfile';
import { supabase } from '../lib/supabase';

export function EditProfileScreen() {
  const navigate = useNavigate();
  const { deleteAccount } = useAuth();
  const { profile, loading, updateProfile, uploadAvatar } = useProfile();
  const [name, setName] = useState(profile?.name ?? '');
  const [category, setCategory] = useState<PlayerCategory | ''>((profile?.category as PlayerCategory | null) ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const currentAvatarUrl = useMemo(() => {
    if (!profile?.avatarUrl) return null;
    return supabase.storage.from('avatars').getPublicUrl(profile.avatarUrl).data.publicUrl;
  }, [profile?.avatarUrl]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaving(true);

    try {
      await updateProfile({
        name,
        category: category || null,
      });
      navigate('/profile');
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel salvar o perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAccount() {
    setError(null);
    setDeleting(true);

    try {
      await deleteAccount();
      navigate('/login', { replace: true });
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Nao foi possivel excluir sua conta.');
    } finally {
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
        <section className="mx-auto max-w-md">
          <ScreenSkeleton rows={4} />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-4 pb-32 pt-6 text-slate-50">
      <section className="mx-auto grid max-w-md gap-5 animate-fade-in">
        <header className="grid gap-3">
          <Link className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-300" to="/profile">
            <Icon name="arrowLeft" size={16} />
            Voltar
          </Link>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-fuchsia-400 to-purple-600 shadow-soft">
              <Icon name="user" size={22} />
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-300">Perfil</p>
              <h1 className="font-display text-3xl font-extrabold text-slate-50">Editar perfil</h1>
            </div>
          </div>
        </header>

        {!profile ? <ErrorBanner message="Nao conseguimos carregar seu perfil." /> : null}

        {profile ? (
          <form className="grid gap-4" onSubmit={handleSubmit}>
            <ImageUpload
              label="Foto de perfil"
              currentUrl={currentAvatarUrl}
              disabled={saving || deleting}
              upload={uploadAvatar}
            />

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">Nickname</span>
              <input
                className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
                value={name}
                minLength={2}
                maxLength={30}
                disabled={saving || deleting}
                onChange={(event) => setName(event.target.value)}
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-bold uppercase tracking-wide text-emerald-300">Categoria</span>
              <select
                className="min-h-[48px] rounded-xl border border-slate-700 bg-slate-950 px-3 text-slate-50 outline-none transition focus:border-emerald-300"
                value={category}
                disabled={saving || deleting}
                onChange={(event) => setCategory(event.target.value as PlayerCategory | '')}
              >
                <option value="">Sem categoria</option>
                {playerCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            {category ? (
              <div className="flex items-center gap-2 rounded-xl border border-slate-800/80 bg-slate-900/50 px-3 py-3">
                <span className="text-xs text-slate-400">Preview</span>
                <CategoryBadge category={category} />
              </div>
            ) : null}

            {error ? <ErrorBanner message={error} /> : null}

            <div className="grid grid-cols-2 gap-3">
              <Link
                className="inline-flex min-h-[48px] items-center justify-center rounded-xl border border-slate-700 px-4 font-bold text-slate-200"
                to="/profile"
              >
                Cancelar
              </Link>
              <button className="btn-primary inline-flex min-h-[48px] items-center justify-center gap-2 rounded-xl px-4 disabled:opacity-60" disabled={saving || deleting} type="submit">
                <Icon name="check" size={18} />
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </form>
        ) : null}

        {profile ? (
          <section className="grid gap-3 rounded-2xl border border-rose-400/25 bg-rose-950/20 p-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/25">
                <Icon name="trash" size={18} />
              </span>
              <div className="grid gap-1">
                <h2 className="text-sm font-extrabold text-rose-100">Excluir conta</h2>
                <p className="text-xs leading-relaxed text-rose-100/75">
                  Remove seu acesso, perfil, ligas criadas, videos e partidas vinculadas a voce.
                </p>
              </div>
            </div>

            {showDeleteConfirm ? (
              <div className="grid gap-3 rounded-xl border border-rose-400/30 bg-slate-950/70 p-3">
                <p className="text-sm font-semibold text-rose-100">
                  Esta acao nao pode ser desfeita. Tem certeza que quer excluir sua conta?
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-slate-700 px-3 text-sm font-bold text-slate-200 disabled:opacity-60"
                    type="button"
                    disabled={deleting}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Cancelar
                  </button>
                  <button
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-rose-400 px-3 text-sm font-extrabold text-rose-950 transition hover:bg-rose-300 disabled:opacity-60"
                    type="button"
                    disabled={deleting}
                    onClick={handleDeleteAccount}
                  >
                    <Icon name="trash" size={16} />
                    {deleting ? 'Excluindo...' : 'Excluir'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl border border-rose-400/35 px-4 text-sm font-bold text-rose-200 transition hover:bg-rose-400/10 disabled:opacity-60"
                type="button"
                disabled={saving || deleting}
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Icon name="trash" size={16} />
                Excluir minha conta
              </button>
            )}
          </section>
        ) : null}
      </section>
    </main>
  );
}
