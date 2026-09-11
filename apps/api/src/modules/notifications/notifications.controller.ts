import type { NotificationView, UnreadCountView } from "@hasut/types";
import { Controller, Get, Param, Post } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { NotificationsService } from "./notifications.service";

@ApiTags("notifications")
@ApiBearerAuth()
@Controller()
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

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
}
