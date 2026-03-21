import './ReviewControls.css';

interface ReviewControlsProps {
  reviewIndex: number;
  totalSteps: number;
  onGoFirst: () => void;
  onGoPrev: () => void;
  onGoNext: () => void;
  onGoLast: () => void;
}

export function ReviewControls({
  reviewIndex,
  totalSteps,
  onGoFirst,
  onGoPrev,
  onGoNext,
  onGoLast,
}: ReviewControlsProps) {
  const isFirst = reviewIndex <= 0;
  const isLast = reviewIndex >= totalSteps - 1;

  return (
    <div className="review-controls" aria-label="Game review controls">
      <div className="review-label">📖 Review Mode</div>
      <div className="review-nav-buttons">
        <button
          className="review-btn"
          onClick={onGoFirst}
          disabled={isFirst}
          aria-label="Go to first position"
          title="First position"
        >
          |◁
        </button>
        <button
          className="review-btn"
          onClick={onGoPrev}
          disabled={isFirst}
          aria-label="Go to previous position"
          title="Previous position"
        >
          ◁
        </button>
        <span className="review-position-indicator">
          {reviewIndex} / {totalSteps - 1}
        </span>
        <button
          className="review-btn"
          onClick={onGoNext}
          disabled={isLast}
          aria-label="Go to next position"
          title="Next position"
        >
          ▷
        </button>
        <button
          className="review-btn"
          onClick={onGoLast}
          disabled={isLast}
          aria-label="Go to last position"
          title="Last position"
        >
          ▷|
        </button>
      </div>
    </div>
  );
}
