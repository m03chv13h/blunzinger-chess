import { Chess } from 'chess.js';

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

const FILES = 'abcdefgh';

function expandFenRank(rank) {
  const result = [];
  for (const ch of rank) {
    const n = parseInt(ch, 10);
    if (!isNaN(n)) {
      for (let i = 0; i < n; i++) result.push('1');
    } else {
      result.push(ch);
    }
  }
  return result;
}

function getChess960CastlingMovesDebug(fen, state) {
  const moves = [];
  const chess = new Chess(fen);
  const side = chess.turn();
  const opponent = side === 'w' ? 'b' : 'w';
  const rankNum = side === 'w' ? '1' : '8';
  
  console.log('Side to move:', side);
  console.log('King at file:', state.kingFile);
  console.log('Queenside rook file:', state.queenSideRookFile);
  console.log('Kingside rook file:', state.kingSideRookFile);
  
  const canKingSide = side === 'w' ? state.castling.whiteKingSide : state.castling.blackKingSide;
  const canQueenSide = side === 'w' ? state.castling.whiteQueenSide : state.castling.blackQueenSide;

  console.log('Can kingside:', canKingSide);
  console.log('Can queenside:', canQueenSide);
  
  if (!canKingSide && !canQueenSide) {
    console.log('Early return: No castling rights available');
    return moves;
  }
  
  const kingFrom = state.kingFile;
  const kingFromSq = `${FILES[kingFrom]}${rankNum}`;
  
  // Parse the board
  const parts = fen.split(' ');
  const ranks = parts[0].split('/');
  const rankIdx = side === 'w' ? 7 : 0;
  const rankChars = expandFenRank(ranks[rankIdx]);
  
  console.log(`Back rank (rank ${rankNum}):`, rankChars.join(''));
  
  if (canKingSide) {
    console.log('\nTesting kingside castling:');
    const rookFrom = state.kingSideRookFile;
    const rookFromSq = `${FILES[rookFrom]}${rankNum}`;
    console.log(`  King from: ${kingFromSq}`);
    console.log(`  Rook from: ${rookFromSq}`);
    
    // Check if rook is at its square
    const rookPiece = chess.get(rookFromSq);
    console.log(`  Rook piece at ${rookFromSq}:`, rookPiece);
    
    const rookPresent = rookPiece && rookPiece.type === 'r' && rookPiece.color === side;
    console.log(`  Rook present and correct color:`, rookPresent);
    
    if (!rookPresent) {
      console.log(`  FAIL: Rook is not present at its original square`);
    }
  }
  
  if (canQueenSide) {
    console.log('\nTesting queenside castling:');
    const rookFrom = state.queenSideRookFile;
    const rookFromSq = `${FILES[rookFrom]}${rankNum}`;
    console.log(`  King from: ${kingFromSq}`);
    console.log(`  Rook from: ${rookFromSq}`);
    
    // Check if rook is at its square
    const rookPiece = chess.get(rookFromSq);
    console.log(`  Rook piece at ${rookFromSq}:`, rookPiece);
    
    const rookPresent = rookPiece && rookPiece.type === 'r' && rookPiece.color === side;
    console.log(`  Rook present and correct color:`, rookPresent);
    
    if (!rookPresent) {
      console.log(`  FAIL: Rook is not present at its original square`);
    }
  }
  
  return moves;
}

const chess960 = {
  positionIndex: 0,
  kingFile: 5, // f-file
  queenSideRookFile: 1, // b-file
  kingSideRookFile: 6, // g-file
  castling: {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true,
  },
};

console.log('Board position:');
const chess = new Chess(fen);
console.log('Black back rank pieces:');
const ranks = fen.split(' ')[0].split('/');
const blackRank = ranks[0]; // First rank is black's 8th rank
console.log('  ' + blackRank);
console.log('');

getChess960CastlingMovesDebug(fen, chess960);
