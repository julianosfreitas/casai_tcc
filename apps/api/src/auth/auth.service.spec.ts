import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PrismaService } from '../prisma/prisma.service';

// O AuthService instancia OAuth2Client diretamente; mockamos o módulo inteiro.
const verifyIdToken = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn(() => ({ verifyIdToken })),
}));

// Testes unitários — sem banco. Prisma e dependências são mockados.
describe('AuthService', () => {
  let auth: AuthService;
  let configGet: jest.Mock;
  let users: jest.Mocked<
    Pick<
      UsersService,
      'create' | 'findByEmail' | 'verifyPassword' | 'findById' | 'findOrCreateGoogleUser'
    >
  >;
  let prisma: {
    refreshToken: {
      create: jest.Mock;
      findUnique: jest.Mock;
      updateMany: jest.Mock;
    };
  };
  let jwt: jest.Mocked<Pick<JwtService, 'signAsync' | 'verifyAsync'>>;

  beforeEach(async () => {
    verifyIdToken.mockReset();
    users = {
      create: jest.fn(),
      findByEmail: jest.fn(),
      verifyPassword: jest.fn(),
      findById: jest.fn(),
      findOrCreateGoogleUser: jest.fn(),
    };
    prisma = {
      refreshToken: {
        create: jest.fn().mockResolvedValue({}),
        findUnique: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    jwt = {
      signAsync: jest.fn().mockResolvedValue('signed.jwt.token'),
      verifyAsync: jest.fn(),
    };
    configGet = jest.fn((k: string) => (k === 'JWT_SECRET' ? 'x'.repeat(40) : undefined));
    const config = { get: configGet };

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: users },
        { provide: PrismaService, useValue: prisma },
        { provide: JwtService, useValue: jwt },
        { provide: ConfigService, useValue: config },
      ],
    }).compile();

    auth = moduleRef.get(AuthService);
  });

  it('signIn devolve tokens quando a senha confere', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      passwordHash: 'hash',
    } as never);
    users.verifyPassword.mockResolvedValue(true);

    const tokens = await auth.signIn('a@a.com', 'Senha@123');

    expect(tokens.accessToken).toBeDefined();
    expect(tokens.refreshToken).toBeDefined();
    expect(prisma.refreshToken.create).toHaveBeenCalledTimes(1);
  });

  it('signIn rejeita senha errada com 401', async () => {
    users.findByEmail.mockResolvedValue({ id: 'u1', email: 'a@a.com', passwordHash: 'h' } as never);
    users.verifyPassword.mockResolvedValue(false);

    await expect(auth.signIn('a@a.com', 'errada')).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.refreshToken.create).not.toHaveBeenCalled();
  });

  it('signIn rejeita e-mail inexistente com a mesma mensagem (anti-enumeração)', async () => {
    users.findByEmail.mockResolvedValue(null);
    await expect(auth.signIn('nao@existe.com', 'x')).rejects.toThrow('E-mail ou senha incorretos');
  });

  it('signIn rejeita conta só-Google (sem senha) com a mesma mensagem genérica', async () => {
    users.findByEmail.mockResolvedValue({
      id: 'u1',
      email: 'a@a.com',
      passwordHash: null,
    } as never);

    await expect(auth.signIn('a@a.com', 'x')).rejects.toThrow('E-mail ou senha incorretos');
    expect(users.verifyPassword).not.toHaveBeenCalled();
  });

  describe('signInWithGoogle', () => {
    const withGoogleConfigured = () => {
      configGet.mockImplementation((k: string) => {
        if (k === 'JWT_SECRET') return 'x'.repeat(40);
        if (k === 'GOOGLE_CLIENT_ID') return 'client-id.apps.googleusercontent.com';
        return undefined;
      });
    };

    it('responde 503 quando GOOGLE_CLIENT_ID não está configurado', async () => {
      await expect(auth.signInWithGoogle('tok')).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('emite tokens para ID token válido com e-mail verificado', async () => {
      withGoogleConfigured();
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({
          sub: 'g-123',
          email: 'a@gmail.com',
          email_verified: true,
          name: 'Ana',
        }),
      });
      users.findOrCreateGoogleUser.mockResolvedValue({ id: 'u1', email: 'a@gmail.com' } as never);

      const tokens = await auth.signInWithGoogle('tok');

      expect(verifyIdToken).toHaveBeenCalledWith({
        idToken: 'tok',
        audience: 'client-id.apps.googleusercontent.com',
      });
      expect(users.findOrCreateGoogleUser).toHaveBeenCalledWith('a@gmail.com', 'Ana', 'g-123');
      expect(tokens.accessToken).toBeDefined();
      expect(tokens.refreshToken).toBeDefined();
    });

    it('rejeita ID token inválido com 401', async () => {
      withGoogleConfigured();
      verifyIdToken.mockRejectedValue(new Error('bad token'));

      await expect(auth.signInWithGoogle('tok')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
    });

    it('rejeita e-mail não verificado pelo Google', async () => {
      withGoogleConfigured();
      verifyIdToken.mockResolvedValue({
        getPayload: () => ({ sub: 'g-123', email: 'a@gmail.com', email_verified: false }),
      });

      await expect(auth.signInWithGoogle('tok')).rejects.toBeInstanceOf(UnauthorizedException);
      expect(users.findOrCreateGoogleUser).not.toHaveBeenCalled();
    });
  });

  it('refresh rejeita token revogado', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@a.com' } as never);
    prisma.refreshToken.findUnique.mockResolvedValue({
      revokedAt: new Date(),
      expiresAt: new Date(Date.now() + 1000),
    });
    await expect(auth.refresh('tok')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('refresh emite novo access token quando válido', async () => {
    jwt.verifyAsync.mockResolvedValue({ sub: 'u1', email: 'a@a.com' } as never);
    prisma.refreshToken.findUnique.mockResolvedValue({
      revokedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const out = await auth.refresh('tok');
    expect(out.accessToken).toBe('signed.jwt.token');
  });

  it('signOut revoga o refresh token do próprio usuário', async () => {
    await auth.signOut('u1', 'tok');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ userId: 'u1' }) }),
    );
  });
});
