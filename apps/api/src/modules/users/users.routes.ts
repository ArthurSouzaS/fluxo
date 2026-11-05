import { Router } from 'express';
import { updateProfileSchema } from '@fluxo/shared';
import { ctx } from '../../lib/context';
import { conflict, notFound } from '../../lib/errors';
import { toUserProfile, userProfileSelect } from '../../lib/mappers';
import { prisma } from '../../lib/prisma';

export const usersRouter = Router();

usersRouter.get('/users/me', async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: ctx(req).userId },
    select: userProfileSelect,
  });
  if (!user) throw notFound('Usuário não encontrado');
  res.json(toUserProfile(user));
});

usersRouter.patch('/users/me', async (req, res) => {
  const { userId } = ctx(req);
  const input = updateProfileSchema.parse(req.body);
  if (input.username) {
    const taken = await prisma.user.findFirst({
      where: { username: input.username, NOT: { id: userId } },
      select: { id: true },
    });
    if (taken) throw conflict('Este apelido já está em uso', 'USERNAME_TAKEN');
  }
  const user = await prisma.user.update({
    where: { id: userId },
    data: input,
    select: userProfileSelect,
  });
  res.json(toUserProfile(user));
});
