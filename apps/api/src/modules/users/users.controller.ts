import type { CurrentMember } from "@hasut/types";
import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { UsersService } from "./users.service";

@ApiTags("me")
@ApiBearerAuth()
@Controller("me")
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @ApiOperation({ summary: "Current authenticated member" })
  me(@CurrentUser("memberId") memberId: string): Promise<CurrentMember> {
    return this.users.getCurrent(memberId);
  }
}
