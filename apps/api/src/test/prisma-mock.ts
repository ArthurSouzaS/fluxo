import { vi } from 'vitest';

/** Cria um mock "profundo" do Prisma: prisma.modelo.metodo é sempre um vi.fn(). */
export function createPrismaMock() {
  const models = new Map<string, Record<string, ReturnType<typeof vi.fn>>>();
  const handler: ProxyHandler<object> = {
    get(_target, model: string) {
      if (model === '$transaction') {
        return vi.fn(async (arg: unknown) =>
          typeof arg === 'function'
            ? (arg as (tx: unknown) => unknown)(proxy)
            : Promise.all(arg as unknown[]),
        );
      }
      if (!models.has(model)) {
        models.set(
          model,
          new Proxy({} as Record<string, ReturnType<typeof vi.fn>>, {
            get(target, method: string) {
              target[method] ??= vi.fn();
              return target[method];
            },
          }),
        );
      }
      return models.get(model);
    },
  };
  const proxy = new Proxy({}, handler) as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
  return proxy;
}
