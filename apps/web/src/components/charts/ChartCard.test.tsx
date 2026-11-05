import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BarChart } from './BarChart';
import { ChartCard } from './ChartCard';

describe('ChartCard + BarChart', () => {
  const rows = [
    {
      key: 'a',
      label: 'Ana',
      segments: [
        { label: 'Em aberto', value: 2, color: 'red' },
        { label: 'Concluídos', value: 3, color: 'green' },
      ],
    },
    {
      key: 'b',
      label: 'Bruno',
      segments: [
        { label: 'Em aberto', value: 1, color: 'red' },
        { label: 'Concluídos', value: 0, color: 'green' },
      ],
    },
  ];

  function renderChart() {
    render(
      <ChartCard
        title="Por responsável"
        legend={[
          { label: 'Em aberto', color: 'red' },
          { label: 'Concluídos', color: 'green' },
        ]}
        table={{
          columns: ['Pessoa', 'Em aberto', 'Concluídos'],
          rows: rows.map((r) => [r.label, r.segments[0]!.value, r.segments[1]!.value]),
        }}
      >
        <BarChart rows={rows} ariaLabel="Gráfico" />
      </ChartCard>,
    );
  }

  it('descreve cada barra para leitores de tela e mostra a legenda', () => {
    renderChart();
    expect(screen.getByRole('img', { name: 'Ana: Em aberto 2, Concluídos 3' })).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Legenda' })).toHaveTextContent('Em abertoConcluídos');
  });

  it('mostra a dica ao focar uma barra', async () => {
    renderChart();
    screen.getByRole('img', { name: 'Bruno: Em aberto 1, Concluídos 0' }).focus();
    expect(await screen.findByRole('status')).toHaveTextContent('Bruno');
  });

  it('alterna para a tabela com os mesmos dados', async () => {
    renderChart();
    await userEvent.click(screen.getByRole('button', { name: 'Tabela' }));
    const table = screen.getByRole('table');
    expect(table).toHaveTextContent('Ana23');
    expect(screen.queryByRole('img', { name: /Ana/ })).not.toBeInTheDocument();
  });
});
