import { Chess } from 'chess.js';

const fen = 'nrbbqkrn/pp1p1p1p/B1p3p1/8/4pP2/2P4P/PP1PP1P1/NRB1QKRN b - - 1 7';

const chess = new Chess(fen);
const moves = chess.moves({ verbose: true });

console.log(`Total moves: ${moves.length}`);
console.log('Testing if all moves can be applied:');

let successCount = 0;
let failCount = 0;

for (const move of moves) {
  const testChess = new Chess(fen);
  try {
    testChess.move(move.san);
    successCount++;
  } catch (e) {
    failCount++;
    console.log(`FAILED: ${move.san} - ${e.message}`);
  }
}

console.log(`\nSuccess: ${successCount}/${moves.length}`);
console.log(`Failures: ${failCount}/${moves.length}`);

if (failCount > 0) {
  console.log('\nThis indicates a problem with move validation in chess.js');
}
