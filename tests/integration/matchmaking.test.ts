import { afterEach, describe, expect, it } from 'vitest';
import { buildMatchmakingSuggestions } from '../../src/services/ranking.service';
import {
  deleteTestPlayers,
  fetchRankingProfilesByEmails,
  getProfiles,
  insertTestPlayers,
  makePlayers,
  updateTestProfileStats,
  type TestPlayer,
} from './helpers';

const createdPlayers: TestPlayer[][] = [];

afterEach(() => {
  while (createdPlayers.length > 0) {
    deleteTestPlayers(createdPlayers.pop()!);
  }
});

describe('matchmaking integration', () => {
  it('excludes the current user and orders suggestions by points delta', () => {
    const players = makePlayers([1000, 1000, 1000, 1000], 'matchmaking');
    createdPlayers.push(players);
    insertTestPlayers(players);

    const profiles = getProfiles(players);
    const byName = new Map(
      players.map((player) => [player.name, profiles.get(player.email)!]),
    );
    const currentUser = byName.get('matchmaking-0')!;

    updateTestProfileStats([
      { id: currentUser.id, points: 1000, wins: 2, losses: 1 },
      { id: byName.get('matchmaking-1')!.id, points: 1040, wins: 3, losses: 0 },
      { id: byName.get('matchmaking-2')!.id, points: 870, wins: 1, losses: 2 },
      { id: byName.get('matchmaking-3')!.id, points: 1320, wins: 4, losses: 1 },
    ]);

    const rows = fetchRankingProfilesByEmails(players.map((player) => player.email));
    const suggestions = buildMatchmakingSuggestions(rows, currentUser.id, 1000);

    expect(suggestions.map((suggestion) => suggestion.name)).toEqual([
      'matchmaking-1',
      'matchmaking-2',
      'matchmaking-3',
    ]);
    expect(suggestions).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: currentUser.id })]),
    );
    expect(suggestions[0]).toEqual(
      expect.objectContaining({
        name: 'matchmaking-1',
        level: 'Amador',
        position: expect.any(Number),
        points: 1040,
        pointDiff: 40,
      }),
    );
  });
});
