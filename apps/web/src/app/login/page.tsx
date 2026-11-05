'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { DEMO_PASSWORD } from '@fluxo/shared/demo';
import { loginSchema } from '@fluxo/shared';
import { AuthLayout } from '@/components/auth/AuthLayout';
import styles from '@/components/auth/AuthForm.module.scss';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth/AuthProvider';
import { IS_DEMO } from '@/lib/config';
import { apiErrors, safeNext, validate, type FieldErrors } from '@/lib/forms';

function LoginForm() {
  const { login, status } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [email, setEmail] = useState(IS_DEMO ? 'arthur@fluxo.dev' : '');
  const [password, setPassword] = useState(IS_DEMO ? DEMO_PASSWORD : '');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace(next);
  }, [status, router, next]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(loginSchema, { email, password });
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    setLoading(true);
    try {
      await login(result.data);
      router.replace(next);
    } catch (error) {
      setErrors(apiErrors(error));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Bem-vindo de volta"
      subtitle="Entre para continuar seus projetos."
      footer={
        <>
          Não tem conta? <Link href="/register">Criar conta grátis</Link>
        </>
      }
    >
      {IS_DEMO ? (
        <div className={styles.demo}>
          <span>
            Demonstração: entre com <code>arthur@fluxo.dev</code> e senha{' '}
            <code>{DEMO_PASSWORD}</code> (já preenchidos).
          </span>
        </div>
      ) : null}
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {errors._form ? (
          <div className={styles.formError} role="alert">
            {errors._form}
          </div>
        ) : null}
        <TextInput
          label="E-mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={errors.email}
        />
        <TextInput
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={errors.password}
        />
        <Button type="submit" variant="primary" size="lg" block loading={loading}>
          Entrar
        </Button>
      </form>
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
