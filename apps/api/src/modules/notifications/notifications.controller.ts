import type {
  NotificationSettingsView,
  NotificationTemplateView,
  NotificationView,
  UnreadCountView,
} from "@hasut/types";
import {
  notificationSettingsPatchSchema,
  notificationTemplateWriteSchema,
  pushSubscriptionSchema,
} from "@hasut/validation";
import { Body, Controller, Delete, Get, Param, Patch, Post, Req } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { Request } from "express";
import { z } from "zod";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { getRequestId } from "../../common/middleware/request-id.middleware";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get("me/notification-settings")
  @ApiOperation({ summary: "Quiet hours and hourly cap" })
  settings(@CurrentUser("memberId") memberId: string): Promise<NotificationSettingsView> {
    return this.notifications.settings(memberId);
  }

  @Patch("me/notification-settings")
  @ApiOperation({ summary: "Update quiet hours and hourly cap" })
  updateSettings(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(notificationSettingsPatchSchema))
    body: z.infer<typeof notificationSettingsPatchSchema>,
  ): Promise<NotificationSettingsView> {
    return this.notifications.updateSettings(memberId, body);
  }

  @Get("me/push-public-key")
  @ApiOperation({ summary: "VAPID public key for Web Push. Empty when push is off." })
  pushKey(): { vapidPublicKey: string } {
    return this.notifications.pushPublicKey();
  }

  @Post("me/push-subscriptions")
  @ApiOperation({ summary: "Store a browser push subscription" })
  savePush(
    @CurrentUser("memberId") memberId: string,
    @Body(new ZodValidationPipe(pushSubscriptionSchema))
    body: z.infer<typeof pushSubscriptionSchema>,
  ): Promise<void> {
    return this.notifications.savePush(memberId, body);
  }

  @Delete("me/push-subscriptions")
  @ApiOperation({ summary: "Remove a browser push subscription" })
  deletePush(
    @CurrentUser("memberId") memberId: string,
    @Body() body: { endpoint?: string },
  ): Promise<void> {
    return this.notifications.deletePush(memberId, body.endpoint ?? "");
  }

  @Get("notifications")
  @ApiOperation({ summary: "In-app notification feed" })
  list(@CurrentUser("memberId") memberId: string): Promise<NotificationView[]> {
    return this.notifications.list(memberId);
  }

  @Get("notifications/unread-count")
  @ApiOperation({ summary: "Unread notification and message counts" })
  unread(@CurrentUser("memberId") memberId: string): Promise<UnreadCountView> {
    return this.notifications.unreadCount(memberId);
  }

  @Post("notifications/read-all")
  @ApiOperation({ summary: "Mark every notification as read" })
  readAll(@CurrentUser("memberId") memberId: string): Promise<{ updated: number }> {
    return this.notifications.markAllRead(memberId);
  }

  @Post("notifications/:id/read")
  @ApiOperation({ summary: "Mark one notification as read" })
  read(
    @CurrentUser("memberId") memberId: string,
    @Param("id") notificationId: string,
  ): Promise<NotificationView> {
    return this.notifications.markRead(memberId, notificationId);
  }

  @Roles("ADMIN")
  @Get("admin/notification-templates")
  @ApiOperation({ summary: "Notification templates" })
  listTemplates(@CurrentUser() user: RequestAuthContext): Promise<NotificationTemplateView[]> {
    return this.notifications.listTemplates(user.roles);
  }

  @Roles("ADMIN")
  @Patch("admin/notification-templates/:id")
  @ApiOperation({ summary: "Update a notification template" })
  updateTemplate(
    @CurrentUser() user: RequestAuthContext,
    @Param("id") templateId: string,
    @Body(new ZodValidationPipe(notificationTemplateWriteSchema))
    body: z.infer<typeof notificationTemplateWriteSchema>,
    @Req() req: Request,
  ): Promise<NotificationTemplateView> {
    return this.notifications.updateTemplate(
      user.memberId,
      user.roles,
      templateId,
      body,
      getRequestId(req),
    );
  }
}
