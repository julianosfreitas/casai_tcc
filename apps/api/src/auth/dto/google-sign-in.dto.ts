import { IsJWT } from 'class-validator';

export class GoogleSignInDto {
  // ID token (credential) emitido pelo botão do Google Identity Services.
  @IsJWT({ message: 'Token do Google inválido' })
  idToken!: string;
}
