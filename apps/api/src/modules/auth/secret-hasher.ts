import { Injectable } from "@nestjs/common";
import { hash, verify } from "argon2";

export const SECRET_HASHER = Symbol("SECRET_HASHER");

export interface SecretHasher {
  hash(plain: string): Promise<string>;
  verify(hashed: string, plain: string): Promise<boolean>;
}

@Injectable()
export class Argon2SecretHasher implements SecretHasher {
  hash(plain: string): Promise<string> {
    return hash(plain);
  }

  verify(hashed: string, plain: string): Promise<boolean> {
    return verify(hashed, plain);
  }
}
