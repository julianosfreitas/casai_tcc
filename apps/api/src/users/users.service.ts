import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import type { User } from '@prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(email: string, name: string, password: string): Promise<User> {
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException('Já existe uma conta com este e-mail');
    }
    const passwordHash = await bcrypt.hash(password, 10);
    return this.prisma.user.create({ data: { email, name, passwordHash } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  /**
   * Login social: localiza a conta pelo googleId; se não existir, vincula a uma
   * conta local com o mesmo e-mail (já verificado pelo Google) ou cria uma nova
   * sem senha (passwordHash nulo).
   */
  async findOrCreateGoogleUser(email: string, name: string, googleId: string): Promise<User> {
    const byGoogleId = await this.prisma.user.findUnique({ where: { googleId } });
    if (byGoogleId) return byGoogleId;

    const byEmail = await this.prisma.user.findUnique({ where: { email } });
    if (byEmail) {
      return this.prisma.user.update({ where: { id: byEmail.id }, data: { googleId } });
    }

    return this.prisma.user.create({ data: { email, name, googleId } });
  }

  async findById(id: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return user;
  }

  /** Verifica a senha em texto puro contra o hash bcrypt armazenado. */
  verifyPassword(plain: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plain, hash);
  }
}
