import { Module } from "@nestjs/common";
import { CategoriesModule } from "../categories/categories.module";
import { LocationsModule } from "../locations/locations.module";
import { ProfessionalsController } from "./professionals.controller";
import { ProfessionalsService } from "./professionals.service";

@Module({
  imports: [CategoriesModule, LocationsModule],
  controllers: [ProfessionalsController],
  providers: [ProfessionalsService],
  exports: [ProfessionalsService],
})
export class ProfessionalsModule {}
