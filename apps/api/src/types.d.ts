declare global {
  namespace Express {
    interface Request {
      /** Id do usuário autenticado (preenchido pelo middleware requireAuth). */
      userId?: string;
    }
  }
}

export {};
