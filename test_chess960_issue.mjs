import { Chess } from 'chess.js';

// This is a Chess960 position in the FEN: nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN
// The back rank is: nrbbqkrn for black and NRB1QKRN for white (position index would need to be calculated)
// But notice the castling rights are '-' (none)

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

// Simulate creating a Chess960State object
// The back rank for white is: NRB1QKRN (which is: rook, bishop, bishop, empty, queen, king, rook, knight reading left to right)
// Wait, that's wrong. Let me parse it correctly: N-R-B-1-Q-K-R-N = a1-b1-c1-d1-e1-f1-g1-h1
// So: Knight on a1, Rook on b1, Bishop on c1, empty d1, Queen on e1, King on f1, Rook on g1, Knight on h1

// According to Chess960 rules:
const pieces = 'NRB1QKRN';
const kingFile = pieces.indexOf('K'); // f1 = file 5
const queenSideRookFile = Math.min(...pieces.split('').map((p, i) => p === 'R' ? i : -1).filter(i => i >= 0));
const kingSideRookFile = Math.max(...pieces.split('').map((p, i) => p === 'R' ? i : -1).filter(i => i >= 0));

console.log('Back rank:', pieces);
console.log('King file:', kingFile, '(0-indexed)');
console.log('Queenside rook file:', queenSideRookFile);
console.log('Kingside rook file:', kingSideRookFile);

// Create a minimal Chess960State
const chess960 = {
  positionIndex: 0, // Unknown
  kingFile,
  queenSideRookFile,
  kingSideRookFile,
  castling: {
    whiteKingSide: false, // No castling rights
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false,
  },
};

console.log('\nChess960State:', chess960);
console.log('');

// Now test getLegalMoves - the issue might be how the FEN with '-' for castling is handled
const chess = new Chess(fen);
const moves = chess.moves({ verbose: true });
console.log('Legal moves from chess.js:', moves.length);

// The question: does chess.js properly handle FEN with '-' for castling?
console.log('Chess.js FEN:', chess.fen());
console.log('Original FEN:', fen);
console.log('Match:', chess.fen() === fen);
