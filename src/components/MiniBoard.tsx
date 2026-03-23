import './MiniBoard.css';

const PIECE_CHARS: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

interface MiniBoardProps {
  fen: string;
}

/** Renders a small 8×8 chess board from a FEN string. */
export function MiniBoard({ fen }: MiniBoardProps) {
  const rows = fen.split(' ')[0].split('/');

  return (
    <div className="mini-board" aria-label="Board thumbnail">
      {rows.map((row, r) => {
        const cells: { piece: string; light: boolean }[] = [];
        let col = 0;
        for (const ch of row) {
          if (ch >= '1' && ch <= '8') {
            const empty = parseInt(ch, 10);
            for (let i = 0; i < empty; i++) {
              cells.push({ piece: '', light: (r + col) % 2 === 0 });
              col++;
            }
          } else {
            cells.push({ piece: PIECE_CHARS[ch] ?? '', light: (r + col) % 2 === 0 });
            col++;
          }
        }
        return (
          <div key={r} className="mini-row">
            {cells.map((cell, c) => (
              <div
                key={c}
                className={`mini-cell ${cell.light ? 'mini-cell--light' : 'mini-cell--dark'}`}
              >
                {cell.piece}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
