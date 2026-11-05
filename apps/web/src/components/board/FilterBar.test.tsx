import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { emptyFilters } from '@/lib/board-state';
import { FilterBar } from './FilterBar';

describe('FilterBar', () => {
  const props = {
    filters: emptyFilters,
    labels: [{ id: 'l1', boardId: 'b', name: 'Bug', color: '#f00' }],
    members: [],
    currentUserId: 'me',
    resultCount: 0,
  };

  it('filtra "Meus cartões" e por etiqueta', async () => {
    const onChange = vi.fn();
    render(<FilterBar {...props} onChange={onChange} />);
    await userEvent.click(screen.getByRole('button', { name: 'Meus cartões' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters, assigneeIds: ['me'] });
    await userEvent.click(screen.getByRole('button', { name: 'Bug' }));
    expect(onChange).toHaveBeenLastCalledWith({ ...emptyFilters, labelIds: ['l1'] });
  });

  it('mostra o total e permite limpar quando há filtros', async () => {
    const onChange = vi.fn();
    render(
      <FilterBar
        {...props}
        filters={{ ...emptyFilters, q: 'x' }}
        resultCount={3}
        onChange={onChange}
      />,
    );
    expect(screen.getByText('3 cartões')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(onChange).toHaveBeenCalledWith(emptyFilters);
  });
});
