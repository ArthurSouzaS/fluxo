'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { registerSchema } from '@fluxo/shared';
import { AuthLayout } from '@/components/auth/AuthLayout';
import styles from '@/components/auth/AuthForm.module.scss';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/Field';
import { useAuth } from '@/lib/auth/AuthProvider';
import { apiErrors, validate, type FieldErrors } from '@/lib/forms';

export default function RegisterPage() {
  const { register, status } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/app');
  }, [status, router]);

  const set = (field: keyof typeof values) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setValues((current) => ({ ...current, [field]: event.target.value }));

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = validate(registerSchema, values);
    if (!result.success) return setErrors(result.errors);
    setErrors({});
    setLoading(true);
    try {
      await register(result.data);
      router.replace('/app');
    } catch (error) {
      setErrors(apiErrors(error));
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Crie sua conta"
      subtitle="Comece a organizar seus projetos em minutos."
      footer={
        <>
          Já tem conta? <Link href="/login">Entrar</Link>
        </>
      }
    >
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        {errors._form ? (
          <div className={styles.formError} role="alert">
            {errors._form}
          </div>
        ) : null}
        <TextInput
          label="Nome"
          autoComplete="name"
          value={values.name}
          onChange={set('name')}
          error={errors.name}
        />
        <TextInput
          label="E-mail"
          type="email"
          autoComplete="email"
          value={values.email}
          onChange={set('email')}
          error={errors.email}
        />
        <TextInput
          label="Senha"
          type="password"
          autoComplete="new-password"
          value={values.password}
          onChange={set('password')}
          error={errors.password}
          hint="Mínimo de 8 caracteres, com letras e números."
        />
        <Button type="submit" variant="primary" size="lg" block loading={loading}>
          Criar conta
        </Button>
      </form>
    </AuthLayout>
  );
}
