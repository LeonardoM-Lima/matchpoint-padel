import { afterEach, describe, expect, it } from 'vitest';
import { buildRankingEntries } from '../../src/services/ranking.service';
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

describe('ranking integration', () => {
  it('orders by points, wins and losses and calculates neighbor point deltas', () => {
    const players = makePlayers([1000, 1000, 1000, 1000, 1000], 'ranking');
    createdPlayers.push(players);
    insertTestPlayers(players);

    const profiles = getProfiles(players);
    const byName = new Map(
      players.map((player) => [player.name, profiles.get(player.email)!]),
    );

    updateTestProfileStats([
      { id: byName.get('ranking-0')!.id, points: 1400, wins: 1, losses: 0 },
      { id: byName.get('ranking-1')!.id, points: 1200, wins: 3, losses: 1 },
      { id: byName.get('ranking-2')!.id, points: 1200, wins: 3, losses: 4 },
      { id: byName.get('ranking-3')!.id, points: 1000, wins: 2, losses: 0 },
      { id: byName.get('ranking-4')!.id, points: 800, wins: 0, losses: 2 },
    ]);

    const rows = fetchRankingProfilesByEmails(players.map((player) => player.email));
    const ranking = buildRankingEntries(rows);

    expect(ranking.map((entry) => entry.name)).toEqual([
      'ranking-0',
      'ranking-1',
      'ranking-2',
      'ranking-3',
      'ranking-4',
    ]);
    expect(ranking.map((entry) => entry.points)).toEqual([1400, 1200, 1200, 1000, 800]);
    expect(ranking[1]).toEqual(expect.objectContaining({ wins: 3, losses: 1 }));
    expect(ranking[2]).toEqual(expect.objectContaining({ wins: 3, losses: 4 }));

    const middleUser = ranking[3]!;
    expect(middleUser).toEqual(
      expect.objectContaining({
        name: 'ranking-3',
        pointDiffToAbove: 200,
        pointDiffToBelow: 200,
      }),
    );
  });
});
