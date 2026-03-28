import { Chess } from 'chess.js';

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

// Figure out the position index from the back rank
const backRank = 'nrbbqkrn';
const pieces = {
  'nrbbqkrn': 'custom position',
};

// Determine files for king and rooks
function getPieceFiles(backRank) {
  const kingFile = backRank.indexOf('k');
  const rooks = [];
  for (let i = 0; i < backRank.length; i++) {
    if (backRank[i] === 'r') rooks.push(i);
  }
  return {
    kingFile,
    queenSideRookFile: rooks[0],
    kingSideRookFile: rooks[1],
  };
}

const files = getPieceFiles(backRank);
console.log('Back rank:', backRank);
console.log('King file:', files.kingFile, `(${String.fromCharCode(97 + files.kingFile)})`);
console.log('Queenside rook file:', files.queenSideRookFile, `(${String.fromCharCode(97 + files.queenSideRookFile)})`);
console.log('Kingside rook file:', files.kingSideRookFile, `(${String.fromCharCode(97 + files.kingSideRookFile)})`);
console.log('');

// Check if this is a valid Chess960 position
const chess = new Chess(fen);
const moves = chess.moves({ verbose: true });
const checking = moves.filter(m => {
  const test = new Chess(fen);
  test.move(m.san);
  return test.inCheck();
});

console.log('Legal moves:', moves.length);
console.log('Checking moves:', checking.length);
console.log('Non-checking moves:', moves.length - checking.length);
console.log('');

// In classic/King Hunt mode, if there are no checking moves, all moves are valid candidates
// In reverse mode, if there are checking moves and non-checking moves, only non-checking are valid
console.log('Bot filtering logic (Classic mode):');
console.log('  Since there are 0 checking moves, regularMoves = all', moves.length, 'moves');
console.log('  Should NOT return null');
console.log('');

// Test a scenario: what if Chess960State is passed but is empty?
const emptyChess960 = undefined;
console.log('If chess960 parameter is undefined:');
console.log('  getLegalMoves will only use chess.moves(), not Chess960 castling');
console.log('  This should be fine since this position has no castling rights anyway');
