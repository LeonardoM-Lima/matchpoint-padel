import { createBrowserRouter } from 'react-router-dom';
import { ProtectedLayout } from '../components/ProtectedLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { AddLeagueMemberScreen } from '../screens/AddLeagueMemberScreen';
import { CreateLeagueScreen } from '../screens/CreateLeagueScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { EditLeagueScreen } from '../screens/EditLeagueScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { LeagueDetailScreen } from '../screens/LeagueDetailScreen';
import { LeagueHistoryScreen } from '../screens/LeagueHistoryScreen';
import { LeaguesScreen } from '../screens/LeaguesScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MatchHistoryScreen } from '../screens/MatchHistoryScreen';
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
          {
            path: '/profile/edit',
            element: <EditProfileScreen />,
          },
          {
            path: '/profile/history',
            element: <MatchHistoryScreen />,
          },
          {
            path: '/leagues',
            element: <LeaguesScreen />,
          },
          {
            path: '/leagues/new',
            element: <CreateLeagueScreen />,
          },
          {
            path: '/leagues/:id',
            element: <LeagueDetailScreen />,
          },
          {
            path: '/leagues/:id/edit',
            element: <EditLeagueScreen />,
          },
          {
            path: '/leagues/:id/history',
            element: <LeagueHistoryScreen />,
          },
          {
            path: '/leagues/:id/add-member',
            element: <AddLeagueMemberScreen />,
          },
        ],
      },
    ],
  },
]);
