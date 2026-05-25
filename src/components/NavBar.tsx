import { NavLink } from 'react-router-dom';
import { Icon } from './Icon';

const items = [
  { to: '/', label: 'Home', icon: 'home' as const },
  { to: '/ranking', label: 'Ranking', icon: 'trophy' as const },
  { to: '/match/new', label: 'Registrar', icon: 'plusCircle' as const, primary: true },
  { to: '/leagues', label: 'Ligas', icon: 'medal' as const },
  { to: '/profile', label: 'Perfil', icon: 'user' as const },
];

export function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
      <div className="glass-strong mx-auto grid max-w-md grid-cols-5 items-end gap-1 rounded-2xl px-2 py-2 shadow-soft">
        {items.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              [
                'group relative flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold transition',
                item.primary ? 'mx-1 -translate-y-3 transform rounded-full p-3 text-slate-950 shadow-glow' : '',
                item.primary
                  ? 'bg-gradient-to-br from-emerald-300 to-emerald-500'
                  : isActive
                    ? 'bg-emerald-300/15 text-emerald-200'
                    : 'text-slate-400 hover:text-emerald-200',
              ].join(' ')
            }
            to={item.to}
            end={item.to === '/'}
          >
            {({ isActive }) => (
              <>
                <Icon name={item.icon} size={item.primary ? 26 : 20} strokeWidth={2.2} />
                {!item.primary ? (
                  <span className={`truncate ${isActive ? 'text-emerald-200' : ''}`}>{item.label}</span>
                ) : null}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
