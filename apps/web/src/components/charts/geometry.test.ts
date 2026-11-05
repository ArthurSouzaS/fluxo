import { columnPath, hBarPath, niceTicks } from './geometry';

describe('niceTicks', () => {
  it('gera marcas arredondadas', () => {
    expect(niceTicks(3)).toEqual([0, 1, 2, 3]);
    expect(niceTicks(9)).toEqual([0, 5, 10]);
    expect(niceTicks(47)).toEqual([0, 20, 40, 60]);
  });

  it('lida com zero', () => {
    expect(niceTicks(0)).toEqual([0, 1]);
  });
});

describe('caminhos', () => {
  it('não desenha barras de largura/altura zero', () => {
    expect(hBarPath(0, 0, 0, 16)).toBe('');
    expect(columnPath(0, 100, 20, 0)).toBe('');
  });

  it('arredonda só a ponta da barra', () => {
    const path = hBarPath(10, 0, 100, 16);
    expect(path.startsWith('M10,0H106')).toBe(true);
    expect(path.endsWith('H10Z')).toBe(true);
  });
});
