import { Chess } from 'chess.js';

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

// This is the function from chess960.ts
function getChess960CastlingMoves(fen, state) {
  const moves = [];
  const chess = new Chess(fen);
  const side = chess.turn();
  const opponent = side === 'w' ? 'b' : 'w';
  
  const canKingSide = side === 'w' ? state.castling.whiteKingSide : state.castling.blackKingSide;
  const canQueenSide = side === 'w' ? state.castling.whiteQueenSide : state.castling.blackQueenSide;

  console.log('Side to move:', side);
  console.log('Can kingside:', canKingSide);
  console.log('Can queenside:', canQueenSide);
  
  if (!canKingSide && !canQueenSide) {
    console.log('No castling rights available - returning empty array');
    return moves;
  }
  
  // ... rest of logic would continue but we early return above
  return moves;
}

// Test 1: Chess960State with NO castling rights (FEN has '-')
const chess960NoRights = {
  positionIndex: 0,
  kingFile: 5, // f-file (0-indexed)
  queenSideRookFile: 1, // b-file
  kingSideRookFile: 6, // g-file
  castling: {
    whiteKingSide: false,
    whiteQueenSide: false,
    blackKingSide: false,
    blackQueenSide: false,
  },
};

console.log('Test 1: Chess960State with NO castling rights');
console.log('==============================================');
const castlingMoves1 = getChess960CastlingMoves(fen, chess960NoRights);
console.log('Result:', castlingMoves1.length, 'castling moves');
console.log('');

// Test 2: Chess960State with ALL castling rights (but FEN has '-')
// This would be a mismatch - the state claims castling is available but FEN doesn't
const chess960WithRights = {
  positionIndex: 0,
  kingFile: 5,
  queenSideRookFile: 1,
  kingSideRookFile: 6,
  castling: {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  },
};

console.log('Test 2: Chess960State WITH castling rights (but FEN has "-")');
console.log('===========================================================');
const castlingMoves2 = getChess960CastlingMoves(fen, chess960WithRights);
console.log('Result:', castlingMoves2.length, 'castling moves');
console.log('');

// Combined legal moves
const chess = new Chess(fen);
const moves = chess.moves({ verbose: true });
console.log('Standard moves from chess.js:', moves.length);
console.log('Combined with castling (test 1):', moves.length + castlingMoves1.length);
console.log('Combined with castling (test 2):', moves.length + castlingMoves2.length);
