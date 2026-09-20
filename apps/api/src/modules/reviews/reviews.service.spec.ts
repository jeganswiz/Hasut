import { Test } from "@nestjs/testing";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { ConnectionsService } from "../connections/connections.service";
import { ProfilesService } from "../profiles/profiles.service";
import { PrismaService } from "../prisma/prisma.service";
import { ReviewsService } from "./reviews.service";

describe("ReviewsService", () => {
  const prisma = {
    professionalProfile: { findUnique: jest.fn() },
    business: { findUnique: jest.fn() },
    review: { create: jest.fn(), findMany: jest.fn(), aggregate: jest.fn() },
    reviewAggregate: { findUnique: jest.fn(), upsert: jest.fn() },
  };
  const connections = { requireAcceptedPair: jest.fn() };
  const profiles = { getPreview: jest.fn() };
  const audit = { record: jest.fn() };

  async function service(): Promise<ReviewsService> {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReviewsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConnectionsService, useValue: connections },
        { provide: ProfilesService, useValue: profiles },
        { provide: AuditService, useValue: audit },
      ],
    }).compile();
    return moduleRef.get(ReviewsService);
  }

  beforeEach(() => {
    jest.resetAllMocks();
    prisma.professionalProfile.findUnique.mockResolvedValue({ id: "pro-1", memberId: "owner-1" });
    connections.requireAcceptedPair.mockResolvedValue({ id: "c1" });
    prisma.review.create.mockResolvedValue({
      id: "r1",
      authorId: "author-1",
      subjectType: "PROFESSIONAL",
      subjectId: "pro-1",
      rating: 5,
      body: "Great",
      createdAt: new Date("2026-09-20T00:00:00.000Z"),
    });
    prisma.review.aggregate.mockResolvedValue({ _avg: { rating: 5 }, _count: { _all: 1 } });
    prisma.reviewAggregate.upsert.mockResolvedValue({});
    profiles.getPreview.mockResolvedValue({ id: "author-1", displayName: "Ada", photoUrl: null });
  });

  it("allows a connected member to write a review", async () => {
    const reviews = await service();
    const created = await reviews.create(
      "author-1",
      { subjectType: "PROFESSIONAL", subjectId: "pro-1", rating: 5, body: "Great" },
      "req",
    );
    expect(created.rating).toBe(5);
    expect(connections.requireAcceptedPair).toHaveBeenCalledWith("author-1", "owner-1");
  });

  it("rejects a self-review", async () => {
    const reviews = await service();
    await expect(
      reviews.create(
        "owner-1",
        { subjectType: "PROFESSIONAL", subjectId: "pro-1", rating: 5, body: "" },
        "req",
      ),
    ).rejects.toBeInstanceOf(HasutHttpException);
  });
});
