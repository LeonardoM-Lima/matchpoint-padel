import { afterEach, describe, expect, it } from 'vitest';
import {
  deleteTestPlayers,
  fetchMatchPlayers,
  fetchProfilesByIds,
  getProfiles,
  insertTestPlayers,
  makePlayers,
  registerMatchWithSql,
  type TestPlayer,
} from './helpers';

const createdPlayers: TestPlayer[][] = [];

async function setupMatchPlayers() {
  const players = makePlayers([1000, 1000, 1000, 1000], 'match');
  createdPlayers.push(players);
  insertTestPlayers(players);

  const profiles = getProfiles(players);
  const profileList = players.map((player) => profiles.get(player.email)!);

  return { profileList };
}

afterEach(() => {
  while (createdPlayers.length > 0) {
    deleteTestPlayers(createdPlayers.pop()!);
  }
});

describe('register_match integration', () => {
  it('persists a valid match and updates wins/losses', async () => {
    const { profileList } = await setupMatchPlayers();

    const matchId = registerMatchWithSql(profileList[0]!.user_id, 6, 4, [
      { profileId: profileList[0]!.id, team: 'A' },
      { profileId: profileList[1]!.id, team: 'A' },
      { profileId: profileList[2]!.id, team: 'B' },
      { profileId: profileList[3]!.id, team: 'B' },
    ]);

    expect(matchId).toEqual(expect.any(String));

    const matchPlayers = fetchMatchPlayers(matchId);
    expect(matchPlayers).toHaveLength(4);

    const updatedProfiles = fetchProfilesByIds(profileList.map((profile) => profile.id));
    expect(updatedProfiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: profileList[0]!.id, wins: 1, losses: 0 }),
        expect.objectContaining({ id: profileList[1]!.id, wins: 1, losses: 0 }),
        expect.objectContaining({ id: profileList[2]!.id, wins: 0, losses: 1 }),
        expect.objectContaining({ id: profileList[3]!.id, wins: 0, losses: 1 }),
      ]),
    );
  });

  it('rejects matches with other than four players', async () => {
    const { profileList } = await setupMatchPlayers();

    expect(() =>
      registerMatchWithSql(profileList[0]!.user_id, 6, 4, [
        { profileId: profileList[0]!.id, team: 'A' },
        { profileId: profileList[1]!.id, team: 'A' },
        { profileId: profileList[2]!.id, team: 'B' },
      ]),
    ).toThrow(/Partida requer exatamente 4 jogadores/);
  });

  it('rejects unbalanced teams', async () => {
    const { profileList } = await setupMatchPlayers();

    expect(() =>
      registerMatchWithSql(profileList[0]!.user_id, 6, 4, [
        { profileId: profileList[0]!.id, team: 'A' },
        { profileId: profileList[1]!.id, team: 'A' },
        { profileId: profileList[2]!.id, team: 'A' },
        { profileId: profileList[3]!.id, team: 'B' },
      ]),
    ).toThrow(/Cada time deve ter exatamente 2 jogadores/);
  });

  it.each([
    [5, 4],
    [6, 5],
    [8, 2],
    [6, 6],
  ])('rejects invalid score %i-%i', async (teamAScore, teamBScore) => {
    const { profileList } = await setupMatchPlayers();

    expect(() =>
      registerMatchWithSql(profileList[0]!.user_id, teamAScore, teamBScore, [
        { profileId: profileList[0]!.id, team: 'A' },
        { profileId: profileList[1]!.id, team: 'A' },
        { profileId: profileList[2]!.id, team: 'B' },
        { profileId: profileList[3]!.id, team: 'B' },
      ]),
    ).toThrow(/Placar invalido/);
  });
});
