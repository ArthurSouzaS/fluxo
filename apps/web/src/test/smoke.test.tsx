import { render, screen } from '@testing-library/react';
import HomePage from '@/app/page';

describe('HomePage', () => {
  it('renderiza', () => {
    render(<HomePage />);
    expect(screen.getByText('Fluxo')).toBeInTheDocument();
  });
});
