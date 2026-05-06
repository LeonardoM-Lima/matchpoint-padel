import { Outlet } from 'react-router-dom';
import { NavBar } from './NavBar';

export function ProtectedLayout() {
  return (
    <>
      <Outlet />
      <NavBar />
    </>
  );
}
