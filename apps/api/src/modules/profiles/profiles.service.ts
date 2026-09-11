import { PROFILE_COMPLETION_FIELDS } from "@hasut/config";
import type {
  CurrentModeView,
  MemberPreview,
  OwnerMemberProfile,
  ProfileCompletion,
  PublicMemberProfile,
} from "@hasut/types";
import { HttpStatus, Injectable } from "@nestjs/common";
import type { CurrentMode, Profile } from "@prisma/client";
import { HasutHttpException } from "../../common/errors/hasut-http.exception";
import { AuditService } from "../audit/audit.service";
import { LocationsService } from "../locations/locations.service";
import { MediaService } from "../media/media.service";
import { PrismaService } from "../prisma/prisma.service";

type ProfileRecord = Profile & { currentMode: CurrentMode | null };

export interface ProfileWriteInput {
  displayName: string;
  bio?: string;
  photoMediaId?: string | null;
  currentModeCode?: string | null;
  statusText?: string;
  isDiscoverable?: boolean;
}

export interface ProfilePatchInput {
  displayName?: string;
  bio?: string;
  photoMediaId?: string | null;
  currentModeCode?: string | null;
  statusText?: string;
  isDiscoverable?: boolean;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly locations: LocationsService,
    private readonly media: MediaService,
    private readonly audit: AuditService,
  ) {}

  async listCurrentModes(): Promise<CurrentModeView[]> {
    const rows = await this.prisma.currentMode.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
    });
    return rows.map((row) => ({ code: row.code, label: row.label }));
  }

  async getOwnerProfile(memberId: string): Promise<OwnerMemberProfile> {
    const profile = await this.loadProfile(memberId);
    if (profile === null) {
      return this.emptyOwnerProfile(memberId);
    }
    return this.toOwner(profile);
  }

  async getPreview(memberId: string): Promise<MemberPreview> {
    const profile = await this.loadProfile(memberId);
    return {
      id: memberId,
      displayName: profile?.displayName ?? "Member",
      photoUrl: await this.media.photoUrl(profile?.photoMediaId ?? null),
    };
  }

  async getPublicProfile(viewerId: string | null, memberId: string): Promise<PublicMemberProfile> {
    const profile = await this.loadProfile(memberId);
    if (profile === null) {
      throw new HasutHttpException("NOT_FOUND", "Profile not found", HttpStatus.NOT_FOUND);
    }
    const isOwner = viewerId === memberId;
    if (!profile.isDiscoverable && !isOwner) {
      throw new HasutHttpException("NOT_FOUND", "Profile not found", HttpStatus.NOT_FOUND);
    }
    return this.toPublic(profile);
  }

  async createOrReplace(
    actorId: string,
    memberId: string,
    input: ProfileWriteInput,
    requestId: string,
  ): Promise<OwnerMemberProfile> {
    this.assertOwner(actorId, memberId);
    const existed = await this.loadProfile(memberId);
    const saved = await this.writeProfile(memberId, input, false);
    await this.audit.record({
      actorId,
      action: existed === null ? "PROFILE_CREATED" : "PROFILE_UPDATED",
      entity: "profile",
      entityId: memberId,
      requestId,
      afterJson: { displayNameSet: saved.displayName.length > 0 },
    });
    return this.toOwner(saved);
  }

  async update(
    actorId: string,
    memberId: string,
    input: ProfilePatchInput,
    requestId: string,
  ): Promise<OwnerMemberProfile> {
    this.assertOwner(actorId, memberId);
    const existing = await this.loadProfile(memberId);
    if (existing === null) {
      throw new HasutHttpException("NOT_FOUND", "Profile not found", HttpStatus.NOT_FOUND);
    }
    const saved = await this.writeProfile(memberId, input, true);
    await this.audit.record({
      actorId,
      action: "PROFILE_UPDATED",
      entity: "profile",
      entityId: memberId,
      requestId,
      afterJson: { fields: Object.keys(input) },
    });
    return this.toOwner(saved);
  }

  async setMode(
    actorId: string,
    memberId: string,
    input: { modeCode: string; statusText?: string },
    requestId: string,
  ): Promise<OwnerMemberProfile> {
    this.assertOwner(actorId, memberId);
    const saved = await this.writeProfile(
      memberId,
      { currentModeCode: input.modeCode, statusText: input.statusText },
      false,
    );
    await this.audit.record({
      actorId,
      action: "PROFILE_UPDATED",
      entity: "profile",
      entityId: memberId,
      requestId,
      afterJson: { fields: ["currentModeCode", "statusText"] },
    });
    return this.toOwner(saved);
  }

  private assertOwner(actorId: string, memberId: string): void {
    if (actorId !== memberId) {
      throw new HasutHttpException(
        "FORBIDDEN",
        "You cannot modify another member's profile",
        HttpStatus.FORBIDDEN,
      );
    }
  }

  private async writeProfile(
    memberId: string,
    input: ProfilePatchInput & Partial<ProfileWriteInput>,
    patch: boolean,
  ): Promise<ProfileRecord> {
    const modeId =
      input.currentModeCode === undefined
        ? undefined
        : await this.resolveModeId(input.currentModeCode);

    if (input.photoMediaId) {
      await this.media.requireReadyAvatar(memberId, input.photoMediaId);
    }

    const existing = await this.prisma.profile.findUnique({ where: { memberId } });
    if (existing === null && patch) {
      throw new HasutHttpException("NOT_FOUND", "Profile not found", HttpStatus.NOT_FOUND);
    }

    const data = {
      displayName: input.displayName ?? existing?.displayName ?? "",
      bio: input.bio ?? existing?.bio ?? "",
      photoMediaId:
        input.photoMediaId === undefined ? (existing?.photoMediaId ?? null) : input.photoMediaId,
      currentModeId: modeId === undefined ? (existing?.currentModeId ?? null) : modeId,
      statusText: input.statusText ?? existing?.statusText ?? "",
      isDiscoverable: input.isDiscoverable ?? existing?.isDiscoverable ?? true,
    };

    return this.prisma.profile.upsert({
      where: { memberId },
      create: { memberId, ...data },
      update: data,
      include: { currentMode: true },
    });
  }

  private async resolveModeId(code: string | null): Promise<string | null> {
    if (code === null) {
      return null;
    }
    const mode = await this.prisma.currentMode.findFirst({
      where: { code, isActive: true },
    });
    if (mode === null) {
      throw new HasutHttpException(
        "VALIDATION_ERROR",
        "Unknown current mode",
        HttpStatus.BAD_REQUEST,
      );
    }
    return mode.id;
  }

  private async loadProfile(memberId: string): Promise<ProfileRecord | null> {
    return this.prisma.profile.findUnique({
      where: { memberId },
      include: { currentMode: true },
    });
  }

  private async toPublic(profile: ProfileRecord): Promise<PublicMemberProfile> {
    return {
      id: profile.memberId,
      displayName: profile.displayName,
      bio: profile.bio,
      photoUrl: await this.media.photoUrl(profile.photoMediaId),
      currentMode:
        profile.currentMode === null
          ? null
          : { code: profile.currentMode.code, label: profile.currentMode.label },
      statusText: profile.statusText,
      approximateLocation: await this.locations.getApproximateLocation(profile.memberId),
    };
  }

  private async toOwner(profile: ProfileRecord): Promise<OwnerMemberProfile> {
    const publicView = await this.toPublic(profile);
    const hasLocation = await this.locations.hasStoredLocation(profile.memberId);
    return {
      ...publicView,
      photoMediaId: profile.photoMediaId,
      isDiscoverable: profile.isDiscoverable,
      completion: this.completion(profile, hasLocation),
    };
  }

  private async emptyOwnerProfile(memberId: string): Promise<OwnerMemberProfile> {
    const hasLocation = await this.locations.hasStoredLocation(memberId);
    return {
      id: memberId,
      displayName: "",
      bio: "",
      photoUrl: null,
      currentMode: null,
      statusText: "",
      approximateLocation: await this.locations.getApproximateLocation(memberId),
      photoMediaId: null,
      isDiscoverable: true,
      completion: this.completion(
        {
          displayName: "",
          bio: "",
          photoMediaId: null,
          currentMode: null,
          statusText: "",
        },
        hasLocation,
      ),
    };
  }

  private completion(
    profile: Pick<
      ProfileRecord,
      "displayName" | "bio" | "photoMediaId" | "currentMode" | "statusText"
    >,
    hasLocation: boolean,
  ): ProfileCompletion {
    const fields = {
      displayName: profile.displayName.trim().length > 0,
      bio: profile.bio.trim().length > 0,
      photo: profile.photoMediaId !== null,
      currentMode: profile.currentMode !== null,
      statusText: profile.statusText.trim().length > 0,
      location: hasLocation,
    };
    const filled = PROFILE_COMPLETION_FIELDS.filter((field) => fields[field]).length;
    return {
      percentage: Math.round((filled / PROFILE_COMPLETION_FIELDS.length) * 100),
      fields,
    };
  }
}
