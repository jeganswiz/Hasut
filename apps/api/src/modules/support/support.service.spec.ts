import { Test } from "@nestjs/testing";
import { AuditService } from "../audit/audit.service";
import { NotificationsService } from "../notifications/notifications.service";
import { PrismaService } from "../prisma/prisma.service";
import { ProfilesService } from "../profiles/profiles.service";
import { SupportService } from "./support.service";

const MEMBER = "11111111-1111-4111-8111-111111111111";
const AGENT = "22222222-2222-4222-8222-222222222222";
const CATEGORY = "33333333-3333-4333-8333-333333333333";
const TICKET = "44444444-4444-4444-8444-444444444444";

describe("SupportService", () => {
  const category = {
    id: CATEGORY,
    slug: "account",
    name: "Account and login",
    isActive: true,
    sortOrder: 10,
  };
  const prisma = {
    supportCategory: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn() },
    supportTicket: { create: jest.fn(), findMany: jest.fn(), update: jest.fn(), count: jest.fn() },
    supportMessage: { create: jest.fn() },
    supportAssignment: { create: jest.fn() },
    supportInternalNote: { create: jest.fn(), findMany: jest.fn() },
    supportEscalation: { create: jest.fn(), findMany: jest.fn() },
    member: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  };
  const profiles = { getPreview: jest.fn() };
  const notifications = { notify: jest.fn() };
  const audit = { record: jest.fn() };

  async function createService(): Promise<SupportService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SupportService,
        { provide: PrismaService, useValue: prisma },
        { provide: ProfilesService, useValue: profiles },
        { provide: NotificationsService, useValue: notifications },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(SupportService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    profiles.getPreview.mockImplementation(async (id: string) => ({
      id,
      displayName: id === MEMBER ? "Ada" : "Agent",
      photoUrl: null,
    }));
    notifications.notify.mockResolvedValue(null);
    prisma.supportInternalNote.findMany.mockResolvedValue([]);
    prisma.supportEscalation.findMany.mockResolvedValue([]);
  });

  it("opens a ticket from a seeded category and omits phone numbers", async () => {
    prisma.supportCategory.findUnique.mockResolvedValue(category);
    prisma.supportTicket.create.mockResolvedValue({ id: TICKET });
    prisma.supportTicket.findMany.mockResolvedValue([
      {
        id: TICKET,
        memberId: MEMBER,
        categoryId: CATEGORY,
        subject: "Cannot sign in",
        status: "OPEN",
        priority: "NORMAL",
        createdAt: new Date("2026-09-20T00:00:00.000Z"),
        updatedAt: new Date("2026-09-20T00:00:00.000Z"),
        category,
        assignments: [],
        messages: [
          {
            id: "msg-1",
            ticketId: TICKET,
            authorMemberId: MEMBER,
            body: "OTP never arrived",
            isInternal: false,
            createdAt: new Date("2026-09-20T00:00:00.000Z"),
          },
        ],
      },
    ]);
    const service = await createService();
    const ticket = await service.createTicket(
      MEMBER,
      { categoryId: CATEGORY, subject: "Cannot sign in", body: "OTP never arrived" },
      "req-ticket",
    );
    expect(ticket.subject).toBe("Cannot sign in");
    expect(ticket.category.slug).toBe("account");
    expect(JSON.stringify(ticket)).not.toMatch(/phone/i);
  });

  it("rejects a member from assigning tickets", async () => {
    const service = await createService();
    await expect(service.assign(MEMBER, ["MEMBER"], TICKET, AGENT, "req-no")).rejects.toMatchObject(
      { errorCode: "FORBIDDEN" },
    );
  });
});
