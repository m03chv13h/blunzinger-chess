import { Chess } from 'chess.js';

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

const chess = new Chess(fen);

// Test basic move generation
const moves = chess.moves({ verbose: true });
console.log('Total legal moves from chess.js:', moves.length);

// Test checking moves
const checkingMoves = moves.filter(move => {
  const test = new Chess(fen);
  test.move(move.san);
  return test.inCheck();
});

console.log('Checking moves:', checkingMoves.length);
if (checkingMoves.length > 0) {
  checkingMoves.slice(0, 5).forEach(m => {
    console.log(`  ${m.san}`);
  });
}

// Test non-checking moves
const nonCheckingMoves = moves.filter(move => {
  const test = new Chess(fen);
  test.move(move.san);
  return !test.inCheck();
});

console.log('Non-checking moves:', nonCheckingMoves.length);

// Now let's check what the FEN's castling field means for Chess960
const fenParts = fen.split(' ');
console.log('\nFEN parts:');
console.log('Board:', fenParts[0]);
console.log('Turn:', fenParts[1]);
console.log('Castling:', fenParts[2]);
console.log('En passant:', fenParts[3]);

// The castling field being '-' means no castling rights
console.log('\nNote: The castling field "-" means NO castling rights');
console.log('This is valid for both standard chess and Chess960');
