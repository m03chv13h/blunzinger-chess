import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { TimeInput } from '../components/TimeInput';
import { formatMsToTime, parseTimeToMs } from '../utils/timeFormat';

describe('formatMsToTime', () => {
  it('formats 0 ms as 0:00', () => {
    expect(formatMsToTime(0)).toBe('0:00');
  });

  it('formats exact minutes', () => {
    expect(formatMsToTime(5 * 60 * 1000)).toBe('5:00');
    expect(formatMsToTime(10 * 60 * 1000)).toBe('10:00');
  });

  it('formats minutes and seconds', () => {
    expect(formatMsToTime(3 * 60 * 1000 + 12 * 1000)).toBe('3:12');
    expect(formatMsToTime(1 * 60 * 1000 + 5 * 1000)).toBe('1:05');
  });

  it('pads seconds with leading zero', () => {
    expect(formatMsToTime(60 * 1000 + 3 * 1000)).toBe('1:03');
  });

  it('handles negative ms as 0:00', () => {
    expect(formatMsToTime(-1000)).toBe('0:00');
  });

  it('rounds to nearest second', () => {
    expect(formatMsToTime(5 * 60 * 1000 + 500)).toBe('5:01');
    expect(formatMsToTime(5 * 60 * 1000 + 499)).toBe('5:00');
  });
});

describe('parseTimeToMs', () => {
  it('parses M:SS format', () => {
    expect(parseTimeToMs('5:00')).toBe(5 * 60 * 1000);
    expect(parseTimeToMs('3:12')).toBe(3 * 60 * 1000 + 12 * 1000);
  });

  it('parses MM:SS format', () => {
    expect(parseTimeToMs('10:30')).toBe(10 * 60 * 1000 + 30 * 1000);
  });

  it('parses plain number as minutes', () => {
    expect(parseTimeToMs('5')).toBe(5 * 60 * 1000);
    expect(parseTimeToMs('10')).toBe(10 * 60 * 1000);
  });

  it('returns NaN for empty string', () => {
    expect(parseTimeToMs('')).toBeNaN();
  });

  it('returns NaN for invalid format', () => {
    expect(parseTimeToMs('abc')).toBeNaN();
    expect(parseTimeToMs('1:2:3')).toBeNaN();
  });

  it('returns NaN for seconds > 59', () => {
    expect(parseTimeToMs('5:60')).toBeNaN();
  });

  it('returns NaN for negative seconds', () => {
    expect(parseTimeToMs('5:-1')).toBeNaN();
  });

  it('handles whitespace', () => {
    expect(parseTimeToMs('  5:00  ')).toBe(5 * 60 * 1000);
  });
});

describe('TimeInput component', () => {
  it('shows formatted initial value', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('5:00');
  });

  it('shows minutes and seconds', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={3 * 60 * 1000 + 12 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('3:12');
  });

  it('allows user to clear the field during editing', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    expect(input.value).toBe('');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('eagerly commits valid time on change', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '3:12' } });
    expect(input.value).toBe('3:12');
    expect(onChange).toHaveBeenCalledWith(3 * 60 * 1000 + 12 * 1000);
  });

  it('interprets plain number as minutes', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '3' } });
    expect(onChange).toHaveBeenCalledWith(3 * 60 * 1000);
  });

  it('restores fallback when blurred with empty value', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '' } });
    fireEvent.blur(input);

    expect(input.value).toBe('5:00');
    expect(onChange).toHaveBeenCalledWith(5 * 60 * 1000);
  });

  it('clamps to minSeconds on blur', () => {
    const onChange = vi.fn();
    render(
      <TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} minSeconds={60} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '0:10' } });
    fireEvent.blur(input);

    expect(input.value).toBe('1:00');
    expect(onChange).toHaveBeenLastCalledWith(60 * 1000);
  });

  it('clamps to maxSeconds on blur', () => {
    const onChange = vi.fn();
    render(
      <TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} maxSeconds={600} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: '15:00' } });
    fireEvent.blur(input);

    expect(input.value).toBe('10:00');
    expect(onChange).toHaveBeenLastCalledWith(600 * 1000);
  });

  it('syncs from external value change', () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />,
    );
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input.value).toBe('5:00');

    rerender(<TimeInput valueMs={3 * 60 * 1000 + 30 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    expect(input.value).toBe('3:30');
  });

  it('normalizes invalid text to fallback on blur', () => {
    const onChange = vi.fn();
    render(<TimeInput valueMs={5 * 60 * 1000} onChange={onChange} fallbackMs={5 * 60 * 1000} />);
    const input = screen.getByRole('textbox') as HTMLInputElement;

    fireEvent.change(input, { target: { value: 'abc' } });
    fireEvent.blur(input);

    expect(input.value).toBe('5:00');
    expect(onChange).toHaveBeenCalledWith(5 * 60 * 1000);
  });
});
