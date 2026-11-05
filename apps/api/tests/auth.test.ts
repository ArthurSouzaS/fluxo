import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/lib/prisma';
import { api, createUser } from './helpers';

const refreshCookie = (res: request.Response) =>
  (res.headers['set-cookie'] as unknown as string[] | undefined)
    ?.find((cookie) => cookie.startsWith('fluxo_refresh='))
    ?.split(';')[0];

describe('POST /api/auth/register', () => {
  it('cria a conta, devolve o access token e grava o refresh em cookie httpOnly', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ana Júlia', email: 'ANA@Teste.com', password: 'senhaSegura1' })
      .expect(201);

    expect(res.body.user).toMatchObject({
      name: 'Ana Júlia',
      email: 'ana@teste.com',
      username: 'ana.julia',
    });
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.accessToken).toEqual(expect.any(String));
    const cookie = (res.headers['set-cookie'] as unknown as string[])[0]!;
    expect(cookie).toMatch(/fluxo_refresh=.+HttpOnly/);
    expect(cookie).toContain('Path=/api/auth');
  });

  it('cria um workspace pessoal para o novo usuário', async () => {
    const user = await createUser('Bruno Silva');
    const res = await api().get('/api/workspaces').set(user.auth).expect(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0]).toMatchObject({ name: 'Espaço de Bruno', role: 'OWNER' });
  });

  it('gera apelidos únicos para nomes iguais', async () => {
    const first = await createUser('Carla Dias');
    const second = await createUser('Carla Dias');
    expect(first.username).toBe('carla.dias');
    expect(second.username).toBe('carla.dias2');
  });

  it('recusa e-mail já cadastrado (409)', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Outra', email: user.email, password: 'senhaSegura1' })
      .expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('valida os campos (400) com detalhes por campo', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'A', email: 'invalido', password: '123' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const paths = res.body.error.details.map((d: { path: string }) => d.path);
    expect(paths).toEqual(expect.arrayContaining(['name', 'email', 'password']));
  });

  it('exige senha com letras e números', async () => {
    const res = await api()
      .post('/api/auth/register')
      .send({ name: 'Ana', email: 'ana@teste.com', password: 'somenteletras' })
      .expect(400);
    expect(res.body.error.message).toMatch(/número/);
  });

  it('responde 400 para JSON malformado', async () => {
    const res = await api()
      .post('/api/auth/register')
      .set('Content-Type', 'application/json')
      .send('{"name": ')
      .expect(400);
    expect(res.body.error.code).toBe('INVALID_JSON');
  });
});

describe('POST /api/auth/login', () => {
  it('entra com credenciais válidas', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senhaSegura1' })
      .expect(200);
    expect(res.body.user.id).toBe(user.id);
    expect(refreshCookie(res)).toBeDefined();
  });

  it('recusa senha errada com mensagem genérica (401)', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'errada123' })
      .expect(401);
    expect(res.body.error).toMatchObject({
      code: 'INVALID_CREDENTIALS',
      message: 'E-mail ou senha incorretos',
    });
  });

  it('recusa e-mail inexistente com a mesma mensagem (401)', async () => {
    const res = await api()
      .post('/api/auth/login')
      .send({ email: 'ninguem@teste.com', password: 'qualquer1' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('aplica rate limit após muitas tentativas falhas (429)', async () => {
    const limitedApp = createApp({ rateLimit: true });
    for (let i = 0; i < 20; i += 1) {
      await request(limitedApp)
        .post('/api/auth/login')
        .send({ email: 'alvo@teste.com', password: 'errada123' })
        .expect(401);
    }
    const res = await request(limitedApp)
      .post('/api/auth/login')
      .send({ email: 'alvo@teste.com', password: 'errada123' })
      .expect(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

describe('POST /api/auth/refresh', () => {
  it('troca o refresh token por um novo par (rotação)', async () => {
    const user = await createUser();
    const res = await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    const newCookie = refreshCookie(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(user.cookie);
  });

  it('detecta reutilização de token e encerra a família inteira', async () => {
    const user = await createUser();
    const first = await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(200);
    const rotated = refreshCookie(first)!;

    // Reutiliza o token antigo bem depois da rotação: suspeita de roubo.
    await prisma.refreshToken.updateMany({
      where: { revokedAt: { not: null } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });
    const reuse = await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
    expect(reuse.body.error.code).toBe('REFRESH_REUSED');

    // O token novo também deixa de valer.
    await api().post('/api/auth/refresh').set('Cookie', rotated).expect(401);
  });

  it('tolera duas renovações simultâneas com o mesmo token (várias abas)', async () => {
    const user = await createUser();
    const [a, b] = await Promise.all([
      api().post('/api/auth/refresh').set('Cookie', user.cookie),
      api().post('/api/auth/refresh').set('Cookie', user.cookie),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // A sessão continua válida.
    await api().post('/api/auth/refresh').set('Cookie', refreshCookie(b)!).expect(200);
  });

  it('responde 401 sem cookie', async () => {
    const res = await api().post('/api/auth/refresh').expect(401);
    expect(res.body.error.code).toBe('REFRESH_MISSING');
  });

  it('responde 401 para token desconhecido', async () => {
    await api().post('/api/auth/refresh').set('Cookie', 'fluxo_refresh=abc').expect(401);
  });

  it('responde 401 para token expirado', async () => {
    const user = await createUser();
    await prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
    expect(res.body.error.code).toBe('REFRESH_EXPIRED');
  });
});

describe('POST /api/auth/logout', () => {
  it('revoga o refresh token e limpa o cookie', async () => {
    const user = await createUser();
    const res = await api().post('/api/auth/logout').set('Cookie', user.cookie).expect(204);
    expect((res.headers['set-cookie'] as unknown as string[])[0]).toMatch(/fluxo_refresh=;/);
    await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
  });

  it('é idempotente sem cookie', async () => {
    await api().post('/api/auth/logout').expect(204);
  });
});

describe('POST /api/auth/change-password', () => {
  it('troca a senha, encerra as sessões antigas e devolve nova sessão', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: 'senhaSegura1', newPassword: 'novaSenha2' })
      .expect(200);
    expect(refreshCookie(res)).toBeDefined();

    await api().post('/api/auth/refresh').set('Cookie', user.cookie).expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'senhaSegura1' })
      .expect(401);
    await api()
      .post('/api/auth/login')
      .send({ email: user.email, password: 'novaSenha2' })
      .expect(200);
  });

  it('recusa senha atual incorreta (401)', async () => {
    const user = await createUser();
    const res = await api()
      .post('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: 'errada123', newPassword: 'novaSenha2' })
      .expect(401);
    expect(res.body.error.code).toBe('INVALID_PASSWORD');
  });

  it('recusa nova senha igual à atual (400)', async () => {
    const user = await createUser();
    await api()
      .post('/api/auth/change-password')
      .set(user.auth)
      .send({ currentPassword: 'senhaSegura1', newPassword: 'senhaSegura1' })
      .expect(400);
  });

  it('exige autenticação (401)', async () => {
    await api()
      .post('/api/auth/change-password')
      .send({ currentPassword: 'a', newPassword: 'novaSenha2' })
      .expect(401);
  });
});

describe('Rotas protegidas', () => {
  it('recusam requisições sem token', async () => {
    const res = await api().get('/api/users/me').expect(401);
    expect(res.body.error.code).toBe('TOKEN_MISSING');
  });

  it('recusam token inválido', async () => {
    const res = await api()
      .get('/api/users/me')
      .set('Authorization', 'Bearer abc.def.ghi')
      .expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('/api/users/me', () => {
  it('devolve o perfil', async () => {
    const user = await createUser('Perfil Teste');
    const res = await api().get('/api/users/me').set(user.auth).expect(200);
    expect(res.body).toMatchObject({ id: user.id, name: 'Perfil Teste', email: user.email });
  });

  it('atualiza nome, apelido e cor', async () => {
    const user = await createUser();
    const res = await api()
      .patch('/api/users/me')
      .set(user.auth)
      .send({ name: 'Novo Nome', username: 'novo_apelido', avatarColor: '#123abc' })
      .expect(200);
    expect(res.body).toMatchObject({
      name: 'Novo Nome',
      username: 'novo_apelido',
      avatarColor: '#123abc',
    });
  });

  it('recusa apelido em uso (409) e formato inválido (400)', async () => {
    const a = await createUser();
    const b = await createUser();
    await api().patch('/api/users/me').set(b.auth).send({ username: a.username }).expect(409);
    await api().patch('/api/users/me').set(b.auth).send({ username: 'Com Espaço' }).expect(400);
  });

  it('responde 404 se o usuário não existe mais', async () => {
    const user = await createUser();
    await prisma.user.delete({ where: { id: user.id } });
    await api().get('/api/users/me').set(user.auth).expect(404);
  });
});

describe('Infraestrutura', () => {
  it('GET /api/health', async () => {
    const res = await api().get('/api/health').expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('rota inexistente responde 404 em JSON', async () => {
    const res = await api().get('/nao-existe').expect(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    const user = await createUser();
    await api().get('/api/nao-existe').set(user.auth).expect(404);
  });

  it('documentação OpenAPI disponível', async () => {
    const res = await api().get('/docs.json').expect(200);
    expect(res.body.openapi).toBe('3.1.0');
    expect(Object.keys(res.body.paths).length).toBeGreaterThan(35);
  });

  it('envia cabeçalhos de segurança e CORS para a origem permitida', async () => {
    const res = await api().get('/api/health').set('Origin', 'http://localhost:3000').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('não libera CORS para origens desconhecidas', async () => {
    const res = await api().get('/api/health').set('Origin', 'https://malicioso.com').expect(200);
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });
});
