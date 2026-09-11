import { LOCATION_POLICY_DEFAULTS } from "@hasut/config";
import { normalizePhoneE164, snapToGrid } from "@hasut/utils";
import { Prisma, type CurrentMode, type PrismaClient } from "@prisma/client";

const ADMIN_PHONE = "+917010358490";
const DEMO_ORIGIN = { latitude: 13.0418, longitude: 80.2341 };

interface DemoMember {
  key: string;
  phone: string;
  displayName: string;
  bio: string;
  statusText: string;
  mode: string;
  latitude: number;
  longitude: number;
  admin?: boolean;
  professional?: {
    headline: string;
    experienceYears: number;
    availability: string;
    status: "ACTIVE" | "PAUSED";
    verified: boolean;
    categorySlugs: string[];
    skills: string[];
    radiusMeters: number;
    areaLabel: string;
  };
  business?: {
    name: string;
    description: string;
    categorySlug: string;
    latitude: number;
    longitude: number;
  };
}

const DEMO_MEMBERS: DemoMember[] = [
  {
    key: "admin",
    phone: ADMIN_PHONE,
    displayName: "Jegan",
    bio: "HASUT operator exploring the local network.",
    statusText: "Keeping the neighborhood connected",
    mode: "AVAILABLE",
    latitude: DEMO_ORIGIN.latitude,
    longitude: DEMO_ORIGIN.longitude,
    admin: true,
  },
  {
    key: "priya",
    phone: "+919811100101",
    displayName: "Priya Nair",
    bio: "Licensed plumber for apartments and small shops.",
    statusText: "Free after 4pm",
    mode: "PROMOTING_SERVICE",
    latitude: 13.0431,
    longitude: 80.2354,
    professional: {
      headline: "Emergency and scheduled plumbing",
      experienceYears: 8,
      availability: "AVAILABLE",
      status: "ACTIVE",
      verified: true,
      categorySlugs: ["plumbing"],
      skills: ["Leak repair", "Bathroom fitting"],
      radiusMeters: 8_000,
      areaLabel: "T. Nagar and surrounds",
    },
  },
  {
    key: "arun",
    phone: "+919811100102",
    displayName: "Arun Kumar",
    bio: "Residential electrician with same-day visits.",
    statusText: "On a job nearby",
    mode: "WORKING",
    latitude: 13.0396,
    longitude: 80.2318,
    professional: {
      headline: "Wiring, fans, and inverter setup",
      experienceYears: 11,
      availability: "BUSY",
      status: "ACTIVE",
      verified: true,
      categorySlugs: ["electrical"],
      skills: ["House wiring", "Inverter"],
      radiusMeters: 10_000,
      areaLabel: "South Chennai",
    },
  },
  {
    key: "meera",
    phone: "+919811100103",
    displayName: "Meera Iyer",
    bio: "Math and science tutor for grades 6–12.",
    statusText: "Taking evening batches",
    mode: "LOOKING_FOR_WORK",
    latitude: 13.0444,
    longitude: 80.2299,
    professional: {
      headline: "Board exam coaching",
      experienceYears: 6,
      availability: "AVAILABLE",
      status: "ACTIVE",
      verified: false,
      categorySlugs: ["tutoring"],
      skills: ["Mathematics", "Physics"],
      radiusMeters: 5_000,
      areaLabel: "T. Nagar",
    },
  },
  {
    key: "kabir",
    phone: "+919811100104",
    displayName: "Kabir Shah",
    bio: "Strength coach for beginners and desk workers.",
    statusText: "Park sessions at 6am",
    mode: "AVAILABLE",
    latitude: 13.0388,
    longitude: 80.2372,
    professional: {
      headline: "Outdoor fitness coaching",
      experienceYears: 4,
      availability: "AVAILABLE",
      status: "ACTIVE",
      verified: false,
      categorySlugs: ["fitness"],
      skills: ["Strength", "Mobility"],
      radiusMeters: 6_000,
      areaLabel: "Nandanam to T. Nagar",
    },
  },
  {
    key: "nisha",
    phone: "+919811100105",
    displayName: "Nisha Rao",
    bio: "Looking to collaborate on a neighborhood cleanup.",
    statusText: "Open to local projects",
    mode: "LOOKING_FOR_COLLABORATION",
    latitude: 13.0402,
    longitude: 80.2366,
  },
  {
    key: "vikram",
    phone: "+919811100106",
    displayName: "Vikram Patel",
    bio: "Runs a walk-in cafe on the main road.",
    statusText: "Cafe open till 9",
    mode: "LOOKING_FOR_BUSINESS",
    latitude: 13.0426,
    longitude: 80.2325,
    business: {
      name: "Corner Filter Cafe",
      description: "Filter coffee, tiffin, and quiet tables for daytime work.",
      categorySlug: "cafes",
      latitude: 13.0429,
      longitude: 80.2328,
    },
  },
  {
    key: "sana",
    phone: "+919811100107",
    displayName: "Sana Ahmed",
    bio: "Community clinic coordinator.",
    statusText: "Walk-ins welcome",
    mode: "AVAILABLE",
    latitude: 13.0379,
    longitude: 80.2336,
    business: {
      name: "Lotus Wellness Clinic",
      description: "General consults and wellness follow-ups.",
      categorySlug: "clinics",
      latitude: 13.0381,
      longitude: 80.2339,
    },
  },
  {
    key: "rohan",
    phone: "+919811100108",
    displayName: "Rohan Das",
    bio: "New in the area and looking for reliable home help.",
    statusText: "Just moved in",
    mode: "AVAILABLE",
    latitude: 13.0452,
    longitude: 80.2361,
  },
  {
    key: "diya",
    phone: "+919811100109",
    displayName: "Diya Menon",
    bio: "Illustrator looking for local collaborators.",
    statusText: "Sketching at the cafe",
    mode: "CREATING",
    latitude: 13.0392,
    longitude: 80.2294,
  },
];

export async function seedDemoCatalog(prisma: PrismaClient): Promise<void> {
  const extraAdmin = process.env.ADMIN_BOOTSTRAP_PHONE?.trim();
  const modes = await prisma.currentMode.findMany();
  const categories = await prisma.category.findMany();
  const ids = new Map<string, string>();

  for (const demo of DEMO_MEMBERS) {
    ids.set(demo.key, await upsertDemoMember(prisma, demo, modes, categories));
  }
  if (extraAdmin !== undefined && extraAdmin.length > 0) {
    const phone = normalizePhoneE164(extraAdmin);
    if (phone !== ADMIN_PHONE) {
      const member = await prisma.member.upsert({
        where: { phoneE164: phone },
        create: { phoneE164: phone },
        update: {},
      });
      await grantRoles(prisma, member.id, true);
    }
  }

  const adminId = requireId(ids, "admin");
  const priyaId = requireId(ids, "priya");
  const arunId = requireId(ids, "arun");
  const meeraId = requireId(ids, "meera");
  const rohanId = requireId(ids, "rohan");
  const diyaId = requireId(ids, "diya");
  const vikramId = requireId(ids, "vikram");
  const kabirId = requireId(ids, "kabir");

  const priyaChat = await upsertConnection(prisma, adminId, priyaId, "ACCEPTED", adminId);
  const arunChat = await upsertConnection(prisma, adminId, arunId, "ACCEPTED", arunId);
  await upsertConnection(prisma, adminId, meeraId, "ACCEPTED", meeraId);
  await upsertConnection(prisma, rohanId, adminId, "PENDING", rohanId);
  await upsertConnection(prisma, adminId, diyaId, "PENDING", adminId);
  await upsertConnection(prisma, priyaId, vikramId, "ACCEPTED", priyaId);

  if (priyaChat !== null) {
    await seedThread(prisma, priyaChat, priyaId, adminId, [
      { senderId: priyaId, body: "Hi Jegan — I can take the leak visit tomorrow morning." },
      { senderId: adminId, body: "Perfect. I will share the apartment details." },
      { senderId: priyaId, body: "Noted. I am around T. Nagar after 10." },
    ]);
  }
  if (arunChat !== null) {
    await seedThread(prisma, arunChat, arunId, adminId, [
      { senderId: arunId, body: "Fan regulator is fixed. Call if it trips again." },
    ]);
  }

  await seedNotification(prisma, adminId, "connection.requested", {
    actorName: "Rohan Das",
    actorId: rohanId,
  });
  await seedNotification(prisma, adminId, "message.received", {
    actorName: "Priya Nair",
    actorId: priyaId,
  });

  const kabirProfessional = await prisma.professionalProfile.findUnique({
    where: { memberId: kabirId },
  });
  if (kabirProfessional !== null) {
    const existing = await prisma.verificationRequest.findFirst({
      where: { memberId: kabirId, type: "IDENTITY" },
    });
    if (existing === null) {
      await prisma.verificationRequest.create({
        data: {
          memberId: kabirId,
          type: "IDENTITY",
          status: "PENDING",
          payloadJson: { note: "Demo identity review" },
        },
      });
    }
  }
}

async function upsertDemoMember(
  prisma: PrismaClient,
  demo: DemoMember,
  modes: CurrentMode[],
  categories: Array<{ id: string; slug: string }>,
): Promise<string> {
  const phone = normalizePhoneE164(demo.phone);
  const member = await prisma.member.upsert({
    where: { phoneE164: phone },
    create: { phoneE164: phone },
    update: {},
  });
  await grantRoles(prisma, member.id, demo.admin === true);
  const mode = modes.find((item) => item.code === demo.mode);
  await prisma.profile.upsert({
    where: { memberId: member.id },
    create: {
      memberId: member.id,
      displayName: demo.displayName,
      bio: demo.bio,
      statusText: demo.statusText,
      currentModeId: mode?.id ?? null,
      isDiscoverable: true,
    },
    update: {
      displayName: demo.displayName,
      bio: demo.bio,
      statusText: demo.statusText,
      currentModeId: mode?.id ?? null,
      isDiscoverable: true,
    },
  });
  await writeMemberLocation(prisma, member.id, demo.latitude, demo.longitude);

  if (demo.professional !== undefined) {
    await upsertProfessional(prisma, member.id, demo, categories);
  }
  if (demo.business !== undefined) {
    await upsertBusiness(prisma, member.id, demo.business, categories);
  }
  return member.id;
}

async function grantRoles(prisma: PrismaClient, memberId: string, admin: boolean): Promise<void> {
  await prisma.memberRole.upsert({
    where: { memberId_role: { memberId, role: "MEMBER" } },
    create: { memberId, role: "MEMBER" },
    update: {},
  });
  if (admin) {
    await prisma.memberRole.upsert({
      where: { memberId_role: { memberId, role: "ADMIN" } },
      create: { memberId, role: "ADMIN" },
      update: {},
    });
  }
}

async function writeMemberLocation(
  prisma: PrismaClient,
  memberId: string,
  latitude: number,
  longitude: number,
): Promise<void> {
  const snapped = snapToGrid({ latitude, longitude }, LOCATION_POLICY_DEFAULTS.cellSizeMeters);
  await prisma.memberLocation.upsert({
    where: { memberId },
    create: { memberId, permission: "GRANTED", accuracyMeters: 18 },
    update: { permission: "GRANTED", accuracyMeters: 18 },
  });
  await prisma.memberPublicLocation.upsert({
    where: { memberId },
    create: {
      memberId,
      label: "T. Nagar, Chennai",
      city: "Chennai",
      region: "Tamil Nadu",
      country: "India",
      countryCode: "IN",
      cellId: snapped.cellId,
    },
    update: {
      label: "T. Nagar, Chennai",
      city: "Chennai",
      region: "Tamil Nadu",
      country: "India",
      countryCode: "IN",
      cellId: snapped.cellId,
    },
  });
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE member_locations
      SET geog = ST_SetSRID(ST_MakePoint(${longitude}, ${latitude}), 4326)::geography
      WHERE member_id = ${memberId}::uuid
    `,
  );
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE member_public_locations
      SET approx_geog = ST_SetSRID(ST_MakePoint(${snapped.longitude}, ${snapped.latitude}), 4326)::geography
      WHERE member_id = ${memberId}::uuid
    `,
  );
}

async function upsertProfessional(
  prisma: PrismaClient,
  memberId: string,
  demo: DemoMember,
  categories: Array<{ id: string; slug: string }>,
): Promise<void> {
  const spec = demo.professional;
  if (spec === undefined) {
    return;
  }
  const professional = await prisma.professionalProfile.upsert({
    where: { memberId },
    create: {
      memberId,
      headline: spec.headline,
      experienceYears: spec.experienceYears,
      availability: spec.availability,
      status: spec.status,
      identityVerificationStatus: spec.verified ? "VERIFIED" : "PENDING",
      submittedAt: new Date(),
    },
    update: {
      headline: spec.headline,
      experienceYears: spec.experienceYears,
      availability: spec.availability,
      status: spec.status,
      identityVerificationStatus: spec.verified ? "VERIFIED" : "PENDING",
    },
  });
  await prisma.professionalCategory.deleteMany({
    where: { professionalProfileId: professional.id },
  });
  const categoryIds = spec.categorySlugs
    .map((slug) => categories.find((item) => item.slug === slug)?.id)
    .filter((id): id is string => id !== undefined);
  if (categoryIds.length > 0) {
    await prisma.professionalCategory.createMany({
      data: categoryIds.map((categoryId) => ({
        professionalProfileId: professional.id,
        categoryId,
      })),
    });
  }
  await prisma.professionalSkill.deleteMany({ where: { professionalProfileId: professional.id } });
  await prisma.professionalSkill.createMany({
    data: spec.skills.map((label) => ({
      professionalProfileId: professional.id,
      label,
      categoryId: categoryIds[0] ?? null,
    })),
  });
  await prisma.serviceArea.upsert({
    where: { professionalProfileId: professional.id },
    create: {
      professionalProfileId: professional.id,
      radiusMeters: spec.radiusMeters,
      label: spec.areaLabel,
      city: "Chennai",
      region: "Tamil Nadu",
      country: "India",
      countryCode: "IN",
    },
    update: {
      radiusMeters: spec.radiusMeters,
      label: spec.areaLabel,
    },
  });
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE service_areas
      SET center_geog = ST_SetSRID(ST_MakePoint(${demo.longitude}, ${demo.latitude}), 4326)::geography
      WHERE professional_profile_id = ${professional.id}::uuid
    `,
  );
  await prisma.reviewAggregate.upsert({
    where: {
      subjectType_subjectId: { subjectType: "PROFESSIONAL", subjectId: professional.id },
    },
    create: {
      subjectType: "PROFESSIONAL",
      subjectId: professional.id,
      avgRating: spec.verified ? 4.8 : 4.3,
      count: spec.verified ? 14 : 6,
    },
    update: { avgRating: spec.verified ? 4.8 : 4.3, count: spec.verified ? 14 : 6 },
  });
}

async function upsertBusiness(
  prisma: PrismaClient,
  ownerMemberId: string,
  spec: NonNullable<DemoMember["business"]>,
  categories: Array<{ id: string; slug: string }>,
): Promise<void> {
  const categoryId = categories.find((item) => item.slug === spec.categorySlug)?.id;
  const existing = await prisma.business.findFirst({
    where: { ownerMemberId, name: spec.name },
  });
  const business =
    existing ??
    (await prisma.business.create({
      data: {
        ownerMemberId,
        name: spec.name,
        description: spec.description,
        status: "ACTIVE",
        verificationStatus: "VERIFIED",
        hoursJson: {
          monday: "08:00-21:00",
          tuesday: "08:00-21:00",
          wednesday: "08:00-21:00",
          thursday: "08:00-21:00",
          friday: "08:00-21:00",
          saturday: "08:00-22:00",
          sunday: "09:00-18:00",
        },
      },
    }));
  if (existing !== null) {
    await prisma.business.update({
      where: { id: existing.id },
      data: { description: spec.description, status: "ACTIVE", verificationStatus: "VERIFIED" },
    });
  }
  if (categoryId !== undefined) {
    await prisma.businessCategory.upsert({
      where: { businessId_categoryId: { businessId: business.id, categoryId } },
      create: { businessId: business.id, categoryId },
      update: {},
    });
  }
  await prisma.businessLocation.upsert({
    where: { businessId: business.id },
    create: {
      businessId: business.id,
      label: "T. Nagar, Chennai",
      city: "Chennai",
      region: "Tamil Nadu",
      country: "India",
      countryCode: "IN",
      isPublic: true,
    },
    update: { isPublic: true },
  });
  await prisma.$executeRaw(
    Prisma.sql`
      UPDATE business_locations
      SET geog = ST_SetSRID(ST_MakePoint(${spec.longitude}, ${spec.latitude}), 4326)::geography
      WHERE business_id = ${business.id}::uuid
    `,
  );
  await prisma.reviewAggregate.upsert({
    where: { subjectType_subjectId: { subjectType: "BUSINESS", subjectId: business.id } },
    create: { subjectType: "BUSINESS", subjectId: business.id, avgRating: 4.6, count: 22 },
    update: { avgRating: 4.6, count: 22 },
  });
}

async function upsertConnection(
  prisma: PrismaClient,
  requesterId: string,
  addresseeId: string,
  status: "PENDING" | "ACCEPTED",
  requestedBy: string,
): Promise<string | null> {
  const pairKey = [requesterId, addresseeId].sort().join(":");
  const row = await prisma.connection.upsert({
    where: { pairKey },
    create: {
      requesterId: requestedBy,
      addresseeId: requestedBy === requesterId ? addresseeId : requesterId,
      pairKey,
      status,
    },
    update: {
      status,
      requesterId: requestedBy,
      addresseeId: requestedBy === requesterId ? addresseeId : requesterId,
    },
  });
  if (status !== "ACCEPTED") {
    return null;
  }
  const conversation = await prisma.conversation.upsert({
    where: { connectionId: row.id },
    create: {
      connectionId: row.id,
      participants: {
        createMany: { data: [{ memberId: requesterId }, { memberId: addresseeId }] },
      },
    },
    update: {},
  });
  return conversation.id;
}

async function seedThread(
  prisma: PrismaClient,
  conversationId: string,
  peerId: string,
  adminId: string,
  messages: Array<{ senderId: string; body: string }>,
): Promise<void> {
  const existing = await prisma.message.count({ where: { conversationId } });
  if (existing > 0) {
    return;
  }
  for (const message of messages) {
    const created = await prisma.message.create({
      data: {
        conversationId,
        senderId: message.senderId,
        type: "TEXT",
        body: message.body,
      },
    });
    if (message.senderId !== adminId) {
      continue;
    }
    await prisma.messageRead.create({
      data: { messageId: created.id, memberId: peerId },
    });
  }
  await prisma.conversation.update({
    where: { id: conversationId },
    data: { updatedAt: new Date() },
  });
}

async function seedNotification(
  prisma: PrismaClient,
  memberId: string,
  templateKey: string,
  payload: Record<string, string>,
): Promise<void> {
  const already = await prisma.notification.findFirst({
    where: { memberId, templateKey },
  });
  if (already !== null) {
    return;
  }
  const template = await prisma.notificationTemplate.findUnique({ where: { key: templateKey } });
  if (template === null) {
    return;
  }
  await prisma.notification.create({
    data: {
      memberId,
      templateKey,
      title: template.titleTemplate,
      body: template.bodyTemplate.replace(
        /\{\{(\w+)\}\}/g,
        (_match, key: string) => payload[key] ?? "",
      ),
      payloadJson: payload,
    },
  });
}

function requireId(ids: Map<string, string>, key: string): string {
  const value = ids.get(key);
  if (value === undefined) {
    throw new Error(`Demo member ${key} was not created`);
  }
  return value;
}
