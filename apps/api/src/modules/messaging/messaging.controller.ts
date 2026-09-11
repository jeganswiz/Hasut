import type { ConversationView, MessagePage, MessageView } from "@hasut/types";
import { messageCreateSchema, messageListQuerySchema, messageReadSchema } from "@hasut/validation";
import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { z } from "zod";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe";
import { MessagingService } from "./messaging.service";

type MessageCreate = z.infer<typeof messageCreateSchema>;
type MessageRead = z.infer<typeof messageReadSchema>;
type MessageListQuery = z.infer<typeof messageListQuerySchema>;

@ApiTags("messaging")
@ApiBearerAuth()
@Controller()
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get("conversations")
  @ApiOperation({ summary: "Accepted 1:1 conversations" })
  list(@CurrentUser("memberId") memberId: string): Promise<ConversationView[]> {
    return this.messaging.listConversations(memberId);
  }

  @Get("conversations/:id")
  @ApiOperation({ summary: "One conversation without phone numbers" })
  get(
    @CurrentUser("memberId") memberId: string,
    @Param("id") conversationId: string,
  ): Promise<ConversationView> {
    return this.messaging.getConversation(memberId, conversationId);
  }

  @Get("conversations/:id/messages")
  @ApiOperation({ summary: "Cursor-paginated message history" })
  messages(
    @CurrentUser("memberId") memberId: string,
    @Param("id") conversationId: string,
    @Query(new ZodValidationPipe(messageListQuerySchema)) query: MessageListQuery,
  ): Promise<MessagePage> {
    return this.messaging.listMessages(memberId, conversationId, query.cursor);
  }

  @Post("conversations/:id/messages")
  @ApiOperation({ summary: "Send a text or image message" })
  send(
    @CurrentUser("memberId") memberId: string,
    @Param("id") conversationId: string,
    @Body(new ZodValidationPipe(messageCreateSchema)) body: MessageCreate,
  ): Promise<MessageView> {
    return this.messaging.send(memberId, conversationId, body);
  }

  @Post("conversations/:id/read")
  @ApiOperation({ summary: "Mark messages as read up to a message id" })
  read(
    @CurrentUser("memberId") memberId: string,
    @Param("id") conversationId: string,
    @Body(new ZodValidationPipe(messageReadSchema)) body: MessageRead,
  ): Promise<{ updated: number }> {
    return this.messaging.markRead(memberId, conversationId, body.messageId);
  }
}
