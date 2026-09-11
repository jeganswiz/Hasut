import { Module } from "@nestjs/common";
import { MediaModule } from "../media/media.module";
import { VerificationController } from "./verification.controller";
import { VerificationService } from "./verification.service";

@Module({
  imports: [MediaModule],
  controllers: [VerificationController],
  providers: [VerificationService],
  exports: [VerificationService],
})
export class VerificationModule {}
