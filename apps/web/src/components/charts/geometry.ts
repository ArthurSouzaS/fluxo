/** Funções puras de geometria dos gráficos (testáveis sem DOM). */

/** Escala "bonita" para o eixo: máximo arredondado e marcas inteiras. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const rough = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step =
    [1, 2, 5, 10].map((m) => m * magnitude).find((candidate) => candidate >= rough) ?? rough;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = 0; value <= top + step / 2; value += step)
    ticks.push(Math.round(value * 100) / 100);
  return ticks;
}

/** Barra horizontal com a ponta (direita) arredondada e a base reta. */
export function hBarPath(x: number, y: number, width: number, height: number, radius = 4) {
  if (width <= 0) return '';
  const r = Math.min(radius, width, height / 2);
  return `M${x},${y}H${x + width - r}Q${x + width},${y} ${x + width},${y + r}V${y + height - r}Q${x + width},${y + height} ${x + width - r},${y + height}H${x}Z`;
}

/** Coluna com o topo arredondado e a base reta. */
export function columnPath(x: number, baseline: number, width: number, height: number, radius = 4) {
  if (height <= 0) return '';
  const r = Math.min(radius, height, width / 2);
  const top = baseline - height;
  return `M${x},${baseline}V${top + r}Q${x},${top} ${x + r},${top}H${x + width - r}Q${x + width},${top} ${x + width},${top + r}V${baseline}Z`;
}
