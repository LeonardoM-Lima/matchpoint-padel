export type MatchLabelColor = 'green' | 'yellow' | 'red';

export interface MatchLabel {
  label: string;
  color: MatchLabelColor;
}

export function getMatchLabel(pointsDiff: number, isFavorite: boolean): MatchLabel {
  if (pointsDiff <= 99) return { label: 'Match Perfeito', color: 'green' };
  if (pointsDiff <= 200) return { label: 'Partida Equilibrada', color: 'green' };
  if (pointsDiff <= 300)
    return {
      label: isFavorite ? 'Você é Favorito' : 'Desafio Difícil',
      color: 'yellow',
    };
  return {
    label: isFavorite ? 'Grande Favorito' : 'Grande Desafio',
    color: 'red',
  };
}
