import { Module } from "@nestjs/common";
import { ReportsModule } from "../reports/reports.module";
import { SupportModule } from "../support/support.module";
import { UsersModule } from "../users/users.module";
import { VerificationModule } from "../verification/verification.module";
import { OpsController } from "./ops.controller";

@Module({
  imports: [VerificationModule, ReportsModule, SupportModule, UsersModule],
  controllers: [OpsController],
})
export class OpsModule {}
