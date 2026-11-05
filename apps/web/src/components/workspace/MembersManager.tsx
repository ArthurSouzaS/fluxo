'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  addMemberSchema,
  can,
  canChangeRole,
  canRemoveMember,
  INVITABLE_ROLES,
  ROLE_DESCRIPTIONS,
  ROLE_LABELS,
  ROLES,
  type Member,
  type Role,
  type WorkspaceSummary,
} from '@fluxo/shared';
import { workspacesApi } from '@/lib/api/endpoints';
import { queryKeys } from '@/lib/api/keys';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';
import { Avatar } from '../ui/Avatar';
import { Button, IconButton } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Select, TextInput } from '../ui/Field';
import { ErrorState, errorMessage, Skeleton } from '../ui/States';
import { useToast } from '../ui/Toast';
import styles from './Settings.module.scss';

export function MembersManager({
  workspace,
  onLeft,
}: {
  workspace: WorkspaceSummary;
  onLeft: () => void;
}) {
  const { user } = useAuth();
  const toast = useToast();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<(typeof INVITABLE_ROLES)[number]>('MEMBER');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [removing, setRemoving] = useState<Member | null>(null);
  const [transferTo, setTransferTo] = useState<Member | null>(null);

  const members = useQuery({
    queryKey: queryKeys.members(workspace.id),
    queryFn: () => workspacesApi.members(workspace.id),
  });
  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.members(workspace.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspace(workspace.id) });
    void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
  };

  const add = useMutation({
    mutationFn: () => workspacesApi.addMember(workspace.id, { email, role }),
    onSuccess: (member) => {
      toast.success(`${member.user.name} agora faz parte do workspace`);
      setEmail('');
      invalidate();
    },
    onError: (error) => setErrors(apiErrors(error)),
  });

  const changeRole = useMutation({
    mutationFn: ({ userId, newRole }: { userId: string; newRole: Role }) =>
      workspacesApi.updateMember(workspace.id, userId, newRole),
    onSuccess: () => {
      toast.success('Papel atualizado');
      invalidate();
    },
    onError: (error) => {
      toast.error(errorMessage(error));
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (userId: string) => workspacesApi.removeMember(workspace.id, userId),
    onSuccess: (_data, userId) => {
      setRemoving(null);
      if (userId === user?.id) {
        toast.success('Você saiu do workspace');
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        onLeft();
        return;
      }
      toast.success('Membro removido');
      invalidate();
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  const actor = { id: user?.id ?? '', role: workspace.role };
  const canManage = can(workspace.role, 'member:manage');

  const onAdd = (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(addMemberSchema, { email, role });
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    add.mutate();
  };

  return (
    <section className={styles.card} aria-labelledby="members-title">
      <h2 id="members-title" className={styles.cardTitle}>
        Membros {members.data ? `(${members.data.length})` : ''}
      </h2>
      <p className={styles.cardDescription}>
        Papéis definem o que cada pessoa pode fazer nos quadros deste workspace.
      </p>

      {canManage ? (
        <form className={styles.inviteForm} onSubmit={onAdd} noValidate>
          <TextInput
            label="E-mail de quem já tem conta no Fluxo"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={errors.email ?? (errors._form && !errors.email ? errors._form : undefined)}
            placeholder="pessoa@exemplo.com"
          />
          <Select
            label="Papel"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            {INVITABLE_ROLES.filter(
              (option) => option !== 'ADMIN' || workspace.role === 'OWNER',
            ).map((option) => (
              <option key={option} value={option}>
                {ROLE_LABELS[option]}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" icon="plus" loading={add.isPending}>
            Adicionar
          </Button>
        </form>
      ) : null}

      {members.isPending ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <Skeleton height={48} />
          <Skeleton height={48} />
        </div>
      ) : members.isError ? (
        <ErrorState error={members.error} onRetry={() => members.refetch()} />
      ) : (
        <ul className={styles.members}>
          {members.data.map((member) => {
            const target = { id: member.userId, role: member.role };
            const editable = ROLES.filter(
              (option) => option !== 'OWNER' && canChangeRole(actor, target, option),
            );
            const isMe = member.userId === user?.id;
            return (
              <li key={member.userId} className={styles.member}>
                <Avatar user={member.user} size={36} labelled={false} />
                <span className={styles.memberInfo}>
                  <strong>
                    {member.user.name} {isMe ? <span className={styles.you}>(você)</span> : null}
                  </strong>
                  <span>
                    {member.user.email} · @{member.user.username}
                  </span>
                </span>
                {editable.length ? (
                  <select
                    className={styles.roleSelect}
                    aria-label={`Papel de ${member.user.name}`}
                    value={member.role}
                    onChange={(event) =>
                      changeRole.mutate({
                        userId: member.userId,
                        newRole: event.target.value as Role,
                      })
                    }
                  >
                    {[member.role, ...editable.filter((option) => option !== member.role)].map(
                      (option) => (
                        <option key={option} value={option} title={ROLE_DESCRIPTIONS[option]}>
                          {ROLE_LABELS[option]}
                        </option>
                      ),
                    )}
                  </select>
                ) : (
                  <span className={styles.roleBadge} title={ROLE_DESCRIPTIONS[member.role]}>
                    {ROLE_LABELS[member.role]}
                  </span>
                )}
                {workspace.role === 'OWNER' && !isMe ? (
                  <IconButton
                    icon="sparkles"
                    size="sm"
                    label={`Transferir propriedade para ${member.user.name}`}
                    onClick={() => setTransferTo(member)}
                  />
                ) : null}
                {canRemoveMember(actor, target) ? (
                  <IconButton
                    icon={isMe ? 'logout' : 'trash'}
                    size="sm"
                    label={isMe ? 'Sair do workspace' : `Remover ${member.user.name}`}
                    onClick={() => setRemoving(member)}
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <dl className={styles.roles}>
        {ROLES.map((option) => (
          <div key={option}>
            <dt>{ROLE_LABELS[option]}</dt>
            <dd>{ROLE_DESCRIPTIONS[option]}</dd>
          </div>
        ))}
      </dl>

      <ConfirmDialog
        open={!!removing}
        title={removing?.userId === user?.id ? 'Sair do workspace?' : 'Remover membro?'}
        description={
          removing?.userId === user?.id
            ? 'Você perderá o acesso a todos os quadros deste workspace.'
            : `${removing?.user.name} perderá o acesso aos quadros e será removido dos cartões em que é responsável.`
        }
        confirmLabel={removing?.userId === user?.id ? 'Sair' : 'Remover'}
        loading={remove.isPending}
        onClose={() => setRemoving(null)}
        onConfirm={() => removing && remove.mutate(removing.userId)}
      />
      <ConfirmDialog
        open={!!transferTo}
        title="Transferir propriedade?"
        description={`${transferTo?.user.name} passará a ser o dono do workspace e você virará administrador.`}
        confirmLabel="Transferir"
        loading={changeRole.isPending}
        onClose={() => setTransferTo(null)}
        onConfirm={() => {
          if (transferTo)
            changeRole.mutate(
              { userId: transferTo.userId, newRole: 'OWNER' },
              { onSettled: () => setTransferTo(null) },
            );
        }}
      />
    </section>
  );
}
