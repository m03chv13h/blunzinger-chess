import type { Move } from '../core/blunziger/types';
import './MoveList.css';

interface MoveListProps {
  moves: Move[];
}

export function MoveList({ moves }: MoveListProps) {
  // Group moves into pairs (white, black)
  const pairs: { number: number; white: Move; black?: Move }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
    });
  }

  return (
    <div className="move-list">
      <h3>Moves</h3>
      <div className="move-list-content">
        {pairs.length === 0 && <p className="no-moves">No moves yet</p>}
        {pairs.map((pair) => (
          <div key={pair.number} className="move-pair">
            <span className="move-number">{pair.number}.</span>
            <span className="move-white">{pair.white.san}</span>
            <span className="move-black">{pair.black?.san ?? ''}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
