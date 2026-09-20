import { Module } from "@nestjs/common";
import { AdminMembersController } from "./admin-members.controller";
import { UsersController } from "./users.controller";
import { UsersService } from "./users.service";

@Module({
  controllers: [UsersController, AdminMembersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
