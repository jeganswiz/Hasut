import {
  AUTH_POLICY_CONFIG_KEY,
  AUTH_POLICY_DEFAULTS,
  CURRENT_MODE_SEEDS,
  DEFAULT_THEME_TOKENS,
  LOCATION_POLICY_CONFIG_KEY,
  LOCATION_POLICY_DEFAULTS,
  MEDIA_POLICY_CONFIG_KEY,
  MEDIA_POLICY_DEFAULTS,
  DISCOVERY_POLICY_CONFIG_KEY,
  DISCOVERY_POLICY_DEFAULTS,
  DISCOVERY_RANKING_DEFAULTS,
  MESSAGING_POLICY_CONFIG_KEY,
  MESSAGING_POLICY_DEFAULTS,
  PROFESSIONAL_AVAILABILITY_CONFIG_KEY,
  PROFESSIONAL_AVAILABILITY_DEFAULTS,
  REPORTS_POLICY_CONFIG_KEY,
  REPORTS_POLICY_DEFAULTS,
} from "@hasut/config";
import { PrismaClient, type CategoryAppliesTo } from "@prisma/client";
import { seedDemoCatalog } from "./seed-demo";

const prisma = new PrismaClient();

async function seed(): Promise<void> {
  const rows = await prisma.$queryRaw<Array<{ postgis_version: string }>>`
    SELECT PostGIS_Version() as postgis_version
  `;
  const version = rows[0]?.postgis_version;
  if (version === undefined || version.length === 0) {
    throw new Error("PostGIS is not available; refuse to seed.");
  }

  await prisma.schemaBootstrap.upsert({
    where: { id: "hasut" },
    create: { id: "hasut", postgis: true },
    update: { postgis: true },
  });

  await prisma.remoteConfig.upsert({
    where: { key: AUTH_POLICY_CONFIG_KEY },
    create: {
      key: AUTH_POLICY_CONFIG_KEY,
      valueJson: AUTH_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: LOCATION_POLICY_CONFIG_KEY },
    create: {
      key: LOCATION_POLICY_CONFIG_KEY,
      valueJson: LOCATION_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: MEDIA_POLICY_CONFIG_KEY },
    create: {
      key: MEDIA_POLICY_CONFIG_KEY,
      valueJson: MEDIA_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: DISCOVERY_POLICY_CONFIG_KEY },
    create: {
      key: DISCOVERY_POLICY_CONFIG_KEY,
      valueJson: DISCOVERY_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: MESSAGING_POLICY_CONFIG_KEY },
    create: {
      key: MESSAGING_POLICY_CONFIG_KEY,
      valueJson: MESSAGING_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: REPORTS_POLICY_CONFIG_KEY },
    create: {
      key: REPORTS_POLICY_CONFIG_KEY,
      valueJson: REPORTS_POLICY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.remoteConfig.upsert({
    where: { key: PROFESSIONAL_AVAILABILITY_CONFIG_KEY },
    create: {
      key: PROFESSIONAL_AVAILABILITY_CONFIG_KEY,
      valueJson: PROFESSIONAL_AVAILABILITY_DEFAULTS,
      environment: "all",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "auth.otp" },
    create: {
      key: "auth.otp",
      enabled: true,
      description: "Phone OTP login",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "profiles" },
    create: {
      key: "profiles",
      enabled: true,
      description: "Personal profiles and current mode",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "professionals" },
    create: {
      key: "professionals",
      enabled: true,
      description: "Professional profiles and onboarding",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "discovery" },
    create: {
      key: "discovery",
      enabled: true,
      description: "Nearby discovery and search",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "connections" },
    create: {
      key: "connections",
      enabled: true,
      description: "Connection requests and accepted graph",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "messaging" },
    create: {
      key: "messaging",
      enabled: true,
      description: "One-to-one chat",
    },
    update: {},
  });

  await prisma.featureFlag.upsert({
    where: { key: "notifications" },
    create: {
      key: "notifications",
      enabled: true,
      description: "In-app notifications",
    },
    update: {},
  });

  await seedNotificationTemplates();
  await seedCategories();

  for (const mode of CURRENT_MODE_SEEDS) {
    await prisma.currentMode.upsert({
      where: { code: mode.code },
      create: {
        code: mode.code,
        label: mode.label,
        sortOrder: mode.sortOrder,
        isActive: true,
      },
      update: { label: mode.label, sortOrder: mode.sortOrder },
    });
  }

  const published = await prisma.themeConfig.findFirst({ where: { status: "PUBLISHED" } });
  if (published === null) {
    await prisma.themeConfig.create({
      data: {
        version: 1,
        status: "PUBLISHED",
        tokensJson: DEFAULT_THEME_TOKENS,
        publishedAt: new Date(),
      },
    });
  }

  const activeWeights = await prisma.discoveryRankingWeights.findFirst({ where: { active: true } });
  if (activeWeights === null) {
    await prisma.discoveryRankingWeights.create({
      data: {
        ...DISCOVERY_RANKING_DEFAULTS,
        active: true,
      },
    });
  }

  await seedDemoCatalog(prisma);
}

interface CategorySeed {
  slug: string;
  name: string;
  appliesTo: CategoryAppliesTo;
  sortOrder: number;
  children?: CategorySeed[];
}

async function seedCategories(): Promise<void> {
  const tree: CategorySeed[] = [
    {
      slug: "home-services",
      name: "Home services",
      appliesTo: "PROFESSIONAL",
      sortOrder: 10,
      children: [
        { slug: "plumbing", name: "Plumbing", appliesTo: "PROFESSIONAL", sortOrder: 10 },
        { slug: "electrical", name: "Electrical", appliesTo: "PROFESSIONAL", sortOrder: 20 },
        { slug: "cleaning", name: "Cleaning", appliesTo: "PROFESSIONAL", sortOrder: 30 },
      ],
    },
    {
      slug: "education",
      name: "Education",
      appliesTo: "PROFESSIONAL",
      sortOrder: 20,
      children: [
        { slug: "tutoring", name: "Tutoring", appliesTo: "PROFESSIONAL", sortOrder: 10 },
        { slug: "language", name: "Language coaching", appliesTo: "PROFESSIONAL", sortOrder: 20 },
      ],
    },
    {
      slug: "health-wellness",
      name: "Health and wellness",
      appliesTo: "ALL",
      sortOrder: 30,
      children: [
        { slug: "fitness", name: "Fitness training", appliesTo: "PROFESSIONAL", sortOrder: 10 },
        { slug: "wellness", name: "Wellness", appliesTo: "PROFESSIONAL", sortOrder: 20 },
      ],
    },
    {
      slug: "local-shops",
      name: "Local shops",
      appliesTo: "BUSINESS",
      sortOrder: 40,
      children: [
        { slug: "cafes", name: "Cafes", appliesTo: "BUSINESS", sortOrder: 10 },
        { slug: "clinics", name: "Clinics", appliesTo: "BUSINESS", sortOrder: 20 },
      ],
    },
  ];

  for (const node of tree) {
    await upsertCategoryTree(node, null);
  }
}

async function upsertCategoryTree(node: CategorySeed, parentId: string | null): Promise<void> {
  const saved = await prisma.category.upsert({
    where: { slug: node.slug },
    create: {
      slug: node.slug,
      name: node.name,
      appliesTo: node.appliesTo,
      sortOrder: node.sortOrder,
      parentId,
      isActive: true,
    },
    update: {
      name: node.name,
      appliesTo: node.appliesTo,
      sortOrder: node.sortOrder,
      parentId,
    },
  });
  for (const child of node.children ?? []) {
    await upsertCategoryTree(child, saved.id);
  }
}

async function seedNotificationTemplates(): Promise<void> {
  const templates = [
    {
      key: "connection.requested",
      titleTemplate: "New connection request",
      bodyTemplate: "{{actorName}} wants to connect with you",
    },
    {
      key: "connection.accepted",
      titleTemplate: "Connection accepted",
      bodyTemplate: "{{actorName}} accepted your request",
    },
    {
      key: "message.received",
      titleTemplate: "New message",
      bodyTemplate: "{{actorName}} sent you a message",
    },
  ];
  for (const template of templates) {
    await prisma.notificationTemplate.upsert({
      where: { key: template.key },
      create: template,
      update: {
        titleTemplate: template.titleTemplate,
        bodyTemplate: template.bodyTemplate,
        isActive: true,
      },
    });
  }
}

seed()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "Seed failed";
    process.stderr.write(`${message}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
