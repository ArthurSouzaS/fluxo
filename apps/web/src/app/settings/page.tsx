'use client';

import { useEffect, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { changePasswordSchema, updateProfileSchema } from '@fluxo/shared';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Avatar } from '@/components/ui/Avatar';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useToast } from '@/components/ui/Toast';
import styles from '@/components/workspace/Settings.module.scss';
import { setSession } from '@/lib/api/client';
import { authApi } from '@/lib/api/endpoints';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';
import { useTheme } from '@/lib/theme/ThemeProvider';

const AVATAR_COLORS = [
  '#34d399',
  '#38bdf8',
  '#a78bfa',
  '#f472b6',
  '#fbbf24',
  '#fb7185',
  '#2dd4bf',
  '#94a3b8',
];

export default function SettingsPage() {
  const { user, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const toast = useToast();
  const [profile, setProfile] = useState({
    name: '',
    username: '',
    avatarColor: AVATAR_COLORS[0]!,
  });
  const [profileErrors, setProfileErrors] = useState<FieldErrors>({});
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [passwordErrors, setPasswordErrors] = useState<FieldErrors>({});

  useEffect(() => {
    if (user)
      setProfile({ name: user.name, username: user.username, avatarColor: user.avatarColor });
  }, [user]);

  const saveProfile = useMutation({
    mutationFn: () => authApi.updateProfile(profile),
    onSuccess: (updated) => {
      setUser(updated);
      toast.success('Perfil atualizado');
    },
    onError: (error) => setProfileErrors(apiErrors(error)),
  });

  const changePassword = useMutation({
    mutationFn: () =>
      authApi.changePassword({
        currentPassword: passwords.currentPassword,
        newPassword: passwords.newPassword,
      }),
    onSuccess: (session) => {
      setSession(session);
      setPasswords({ currentPassword: '', newPassword: '', confirm: '' });
      toast.success('Senha alterada. As outras sessões foram encerradas.');
    },
    onError: (error) => setPasswordErrors(apiErrors(error)),
  });

  return (
    <AppShell crumbs={[{ label: 'Workspaces', href: '/app' }, { label: 'Perfil' }]}>
      <PageHeader title="Perfil e conta" description={user?.email} />

      <section className={styles.card} aria-labelledby="profile-title">
        <h2 id="profile-title" className={styles.cardTitle}>
          Perfil
        </h2>
        <p className={styles.cardDescription}>
          Seu apelido é usado nas menções: os colegas escrevem @{profile.username || 'apelido'}.
        </p>
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = validate(updateProfileSchema, profile);
            if (!result.success) return setProfileErrors(result.errors);
            setProfileErrors({});
            saveProfile.mutate();
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Avatar
              user={{ name: profile.name || '?', avatarColor: profile.avatarColor }}
              size={48}
              labelled={false}
            />
            <div className={styles.swatches} role="radiogroup" aria-label="Cor do avatar">
              {AVATAR_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  role="radio"
                  aria-checked={profile.avatarColor === color}
                  aria-label={`Cor ${color}`}
                  className={styles.swatch}
                  style={{ background: color }}
                  onClick={() => setProfile((p) => ({ ...p, avatarColor: color }))}
                />
              ))}
            </div>
          </div>
          <TextInput
            label="Nome"
            value={profile.name}
            onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
            error={profileErrors.name}
          />
          <TextInput
            label="Apelido"
            value={profile.username}
            onChange={(e) => setProfile((p) => ({ ...p, username: e.target.value }))}
            error={profileErrors.username ?? profileErrors._form}
            hint="De 3 a 24 caracteres: letras minúsculas, números, ponto, hífen ou sublinhado."
          />
          <div className={styles.formActions}>
            <Button type="submit" variant="primary" loading={saveProfile.isPending}>
              Salvar perfil
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="password-title">
        <h2 id="password-title" className={styles.cardTitle}>
          Trocar senha
        </h2>
        <p className={styles.cardDescription}>
          Ao trocar a senha, as sessões abertas em outros dispositivos são encerradas.
        </p>
        <form
          className={styles.form}
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const result = validate(changePasswordSchema, passwords);
            if (!result.success) return setPasswordErrors(result.errors);
            if (passwords.newPassword !== passwords.confirm)
              return setPasswordErrors({ confirm: 'As senhas não conferem' });
            setPasswordErrors({});
            changePassword.mutate();
          }}
        >
          <TextInput
            label="Senha atual"
            type="password"
            autoComplete="current-password"
            value={passwords.currentPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, currentPassword: e.target.value }))}
            error={passwordErrors.currentPassword ?? passwordErrors._form}
          />
          <TextInput
            label="Nova senha"
            type="password"
            autoComplete="new-password"
            value={passwords.newPassword}
            onChange={(e) => setPasswords((p) => ({ ...p, newPassword: e.target.value }))}
            error={passwordErrors.newPassword}
            hint="Mínimo de 8 caracteres, com letras e números."
          />
          <TextInput
            label="Confirmar nova senha"
            type="password"
            autoComplete="new-password"
            value={passwords.confirm}
            onChange={(e) => setPasswords((p) => ({ ...p, confirm: e.target.value }))}
            error={passwordErrors.confirm}
          />
          <div className={styles.formActions}>
            <Button type="submit" variant="primary" loading={changePassword.isPending}>
              Trocar senha
            </Button>
          </div>
        </form>
      </section>

      <section className={styles.card} aria-labelledby="appearance-title">
        <h2 id="appearance-title" className={styles.cardTitle}>
          Aparência
        </h2>
        <p className={styles.cardDescription}>O tema também pode ser trocado pela tecla T.</p>
        <div className={styles.formActions} role="radiogroup" aria-label="Tema">
          <Button
            variant={theme === 'dark' ? 'primary' : 'secondary'}
            icon="moon"
            role="radio"
            aria-checked={theme === 'dark'}
            onClick={() => setTheme('dark')}
          >
            Escuro
          </Button>
          <Button
            variant={theme === 'light' ? 'primary' : 'secondary'}
            icon="sun"
            role="radio"
            aria-checked={theme === 'light'}
            onClick={() => setTheme('light')}
          >
            Claro
          </Button>
        </div>
      </section>
    </AppShell>
  );
}
