const { Chess } = require('chess.js');

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

console.log('Testing FEN:', fen);
console.log('');

const chess = new Chess(fen);
console.log('FEN Valid:', chess.fen() === fen);
console.log('Current turn:', chess.turn());
console.log('In check:', chess.inCheck());
console.log('Game over:', chess.isGameOver());
console.log('');

const moves = chess.moves({ verbose: true });
console.log('Total legal moves:', moves.length);
if (moves.length > 0) {
  console.log('First 5 moves:');
  moves.slice(0, 5).forEach(m => {
    console.log(`  ${m.san} (${m.from}${m.to})`);
  });
}
