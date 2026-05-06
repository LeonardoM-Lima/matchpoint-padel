import { createBrowserRouter } from 'react-router-dom';
import { ProtectedLayout } from '../components/ProtectedLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { HomeScreen } from '../screens/HomeScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchmakingScreen } from '../screens/MatchmakingScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RankingScreen } from '../screens/RankingScreen';
import { RegisterMatchScreen } from '../screens/RegisterMatchScreen';
import { RegisterScreen } from '../screens/RegisterScreen';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginScreen />,
  },
  {
    path: '/register',
    element: <RegisterScreen />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <ProtectedLayout />,
        children: [
          {
            path: '/',
            element: <HomeScreen />,
          },
          {
            path: '/match/new',
            element: <RegisterMatchScreen />,
          },
          {
            path: '/ranking',
            element: <RankingScreen />,
          },
          {
            path: '/matchmaking',
            element: <MatchmakingScreen />,
          },
          {
            path: '/profile',
            element: <ProfileScreen />,
          },
        ],
      },
    ],
  },
]);
