import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Member } from '@fluxo/shared';
import { MentionTextarea, mentionQuery } from './MentionTextarea';

const member = (id: string, name: string, username: string): Member => ({
  userId: id,
  role: 'MEMBER',
  joinedAt: '',
  user: { id, name, username, avatarColor: '#34d399', email: `${username}@x.com` },
});
const members = [
  member('1', 'Beatriz Lima', 'beatriz'),
  member('2', 'Bernardo Alves', 'bernardo'),
  member('3', 'Carlos', 'carlos'),
];

function Harness({ onSubmit = () => {} }: { onSubmit?: () => void }) {
  const [value, setValue] = useState('');
  return (
    <MentionTextarea
      label="Comentário"
      value={value}
      onChange={setValue}
      onSubmit={onSubmit}
      members={members}
    />
  );
}

describe('mentionQuery', () => {
  it('detecta o termo após @ antes do cursor', () => {
    expect(mentionQuery('Oi @bea', 7)).toEqual({ query: 'bea', start: 3 });
    expect(mentionQuery('email@x', 7)).toBeNull();
    expect(mentionQuery('@', 1)).toEqual({ query: '', start: 0 });
  });
});

describe('MentionTextarea', () => {
  it('sugere membros e insere o apelido com Enter', async () => {
    render(<Harness />);
    const textarea = screen.getByRole('combobox', { name: 'Comentário' });
    await userEvent.type(textarea, 'Oi @be');
    const options = screen.getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      'BLBeatriz Lima@beatriz',
      'BABernardo Alves@bernardo',
    ]);

    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(textarea).toHaveValue('Oi @bernardo ');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('Ctrl+Enter envia', async () => {
    const onSubmit = vi.fn();
    render(<Harness onSubmit={onSubmit} />);
    await userEvent.type(screen.getByRole('combobox'), 'Olá{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalled();
  });
});
