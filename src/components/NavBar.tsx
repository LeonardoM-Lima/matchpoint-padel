import { NavLink } from 'react-router-dom';

const items = [
  { to: '/', label: 'Home' },
  { to: '/ranking', label: 'Ranking' },
  { to: '/match/new', label: 'Registrar' },
  { to: '/matchmaking', label: 'Jogadores' },
  { to: '/profile', label: 'Perfil' },
];

export function NavBar() {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-800 bg-slate-950/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 text-slate-300 backdrop-blur">
      <div className="mx-auto grid max-w-md grid-cols-5 gap-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            className={({ isActive }) =>
              [
                'flex min-h-[44px] items-center justify-center rounded-lg px-1 text-center text-xs font-semibold',
                isActive ? 'bg-emerald-300 text-slate-950' : 'text-slate-300',
              ].join(' ')
            }
            to={item.to}
            end={item.to === '/'}
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
