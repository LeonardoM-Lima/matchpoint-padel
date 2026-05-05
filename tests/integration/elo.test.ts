import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteTestPlayers,
  fetchMatchPlayers,
  getProfiles,
  insertTestPlayers,
  makePlayers,
  registerMatchWithSql,
  type TestPlayer,
} from './helpers';

const createdPlayers: TestPlayer[][] = [];

async function registerScenario(points: number[], teamAScore = 6, teamBScore = 4) {
  const players = makePlayers(points, 'elo');
  createdPlayers.push(players);
  insertTestPlayers(players);

  const profiles = getProfiles(players);
  const profileList = players.map((player) => profiles.get(player.email)!);

  const matchId = registerMatchWithSql(profileList[0]!.user_id, teamAScore, teamBScore, [
    { profileId: profileList[0]!.id, team: 'A' },
    { profileId: profileList[1]!.id, team: 'A' },
    { profileId: profileList[2]!.id, team: 'B' },
    { profileId: profileList[3]!.id, team: 'B' },
  ]);

  const matchPlayers = fetchMatchPlayers(matchId);

  return { profileList, matchPlayers };
}

afterEach(() => {
  while (createdPlayers.length > 0) {
    deleteTestPlayers(createdPlayers.pop()!);
  }
});

describe('Elo integration', () => {
  it('applies +/-16 when both doubles start at 1000 points', async () => {
    const { matchPlayers } = await registerScenario([1000, 1000, 1000, 1000]);

    expect(matchPlayers).toHaveLength(4);
    expect(matchPlayers.filter((row) => row.team === 'A')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 1000, points_delta: 16, points_after: 1016 }),
        expect.objectContaining({ points_before: 1000, points_delta: 16, points_after: 1016 }),
      ]),
    );
    expect(matchPlayers.filter((row) => row.team === 'B')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 1000, points_delta: -16, points_after: 984 }),
        expect.objectContaining({ points_before: 1000, points_delta: -16, points_after: 984 }),
      ]),
    );
  });

  it('rewards the underdog more when an 800-point double beats a 1200-point double', async () => {
    const { matchPlayers } = await registerScenario([800, 800, 1200, 1200]);

    expect(matchPlayers.filter((row) => row.team === 'A')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 800, points_delta: 29, points_after: 829 }),
        expect.objectContaining({ points_before: 800, points_delta: 29, points_after: 829 }),
      ]),
    );
    expect(matchPlayers.filter((row) => row.team === 'B')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 1200, points_delta: -29, points_after: 1171 }),
        expect.objectContaining({ points_before: 1200, points_delta: -29, points_after: 1171 }),
      ]),
    );
  });

  it('rewards the favorite less when a 1200-point double beats an 800-point double', async () => {
    const { matchPlayers } = await registerScenario([1200, 1200, 800, 800]);

    expect(matchPlayers.filter((row) => row.team === 'A')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 1200, points_delta: 3, points_after: 1203 }),
        expect.objectContaining({ points_before: 1200, points_delta: 3, points_after: 1203 }),
      ]),
    );
    expect(matchPlayers.filter((row) => row.team === 'B')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 800, points_delta: -3, points_after: 797 }),
        expect.objectContaining({ points_before: 800, points_delta: -3, points_after: 797 }),
      ]),
    );
  });

  it('keeps points_after at floor 0', async () => {
    const { matchPlayers } = await registerScenario([10, 10, 10, 10]);

    expect(matchPlayers.filter((row) => row.team === 'A')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 10, points_delta: 16, points_after: 26 }),
        expect.objectContaining({ points_before: 10, points_delta: 16, points_after: 26 }),
      ]),
    );
    expect(matchPlayers.filter((row) => row.team === 'B')).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ points_before: 10, points_delta: -16, points_after: 0 }),
        expect.objectContaining({ points_before: 10, points_delta: -16, points_after: 0 }),
      ]),
    );
  });
});
