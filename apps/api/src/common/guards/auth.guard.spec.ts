import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { HasutHttpException } from "../errors/hasut-http.exception";
import { PrismaService } from "../../modules/prisma/prisma.service";
import { TokenService } from "../../modules/auth/token.service";
import { AuthGuard } from "./auth.guard";

function contextWith(headers: Record<string, string | undefined>): ExecutionContext {
  const request = { headers };
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe("AuthGuard", () => {
  const reflector = {
    getAllAndOverride: jest.fn(),
  };
  const tokens = {
    verifyAccess: jest.fn(),
  };
  const prisma = {
    session: {
      findUnique: jest.fn(),
    },
  };

  async function createGuard(): Promise<AuthGuard> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthGuard,
        { provide: Reflector, useValue: reflector },
        { provide: TokenService, useValue: tokens },
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    return moduleRef.get(AuthGuard);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    reflector.getAllAndOverride.mockReturnValue(false);
  });

  it("rejects unauthorized API access without a bearer token", async () => {
    const guard = await createGuard();
    await expect(guard.canActivate(contextWith({}))).rejects.toBeInstanceOf(HasutHttpException);
    await expect(guard.canActivate(contextWith({}))).rejects.toMatchObject({
      errorCode: "UNAUTHENTICATED",
    });
    expect(tokens.verifyAccess).not.toHaveBeenCalled();
  });

  it("allows public routes without a token", async () => {
    reflector.getAllAndOverride.mockReturnValue(true);
    const guard = await createGuard();
    await expect(guard.canActivate(contextWith({}))).resolves.toBe(true);
  });
});
