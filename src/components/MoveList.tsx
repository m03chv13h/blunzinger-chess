import type { Move } from '../core/blunziger/types';
import './MoveList.css';

interface MoveListProps {
  moves: Move[];
  /** Index of the highlighted move in moveHistory, or -1 for none. */
  highlightedMoveIndex?: number;
  /** Called when the user clicks a move in the list. */
  onMoveClick?: (moveIndex: number) => void;
}

export function MoveList({ moves, highlightedMoveIndex = -1, onMoveClick }: MoveListProps) {
  // Group moves into pairs (white, black)
  const pairs: { number: number; white: Move; black?: Move; whiteIdx: number; blackIdx: number }[] = [];
  for (let i = 0; i < moves.length; i += 2) {
    pairs.push({
      number: Math.floor(i / 2) + 1,
      white: moves[i],
      black: moves[i + 1],
      whiteIdx: i,
      blackIdx: i + 1,
    });
  }

  const handleClick = (idx: number) => {
    if (onMoveClick) {
      onMoveClick(idx);
    }
  };

  return (
    <div className="move-list">
      <h3>Moves</h3>
      <div className="move-list-content">
        {pairs.length === 0 && <p className="no-moves">No moves yet</p>}
        {pairs.map((pair) => (
          <div key={pair.number} className="move-pair">
            <span className="move-number">{pair.number}.</span>
            <span
              className={[
                'move-white',
                pair.whiteIdx === highlightedMoveIndex ? 'move-active' : '',
                onMoveClick ? 'move-clickable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => handleClick(pair.whiteIdx)}
              role={onMoveClick ? 'button' : undefined}
              tabIndex={onMoveClick ? 0 : undefined}
            >
              {pair.white.san}
            </span>
            <span
              className={[
                'move-black',
                pair.blackIdx === highlightedMoveIndex ? 'move-active' : '',
                onMoveClick && pair.black ? 'move-clickable' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => pair.black && handleClick(pair.blackIdx)}
              role={onMoveClick && pair.black ? 'button' : undefined}
              tabIndex={onMoveClick && pair.black ? 0 : undefined}
            >
              {pair.black?.san ?? ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
