import type { OpsSummaryView, StaffMemberView } from "@hasut/types";
import { Controller, Get } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import type { RequestAuthContext } from "../../common/auth/request-auth";
import { assertOpsReadAccess } from "../../common/auth/staff-auth";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import { ReportsService } from "../reports/reports.service";
import { SupportService } from "../support/support.service";
import { UsersService } from "../users/users.service";
import { VerificationService } from "../verification/verification.service";

@ApiTags("ops")
@ApiBearerAuth()
@Controller("admin")
export class OpsController {
  constructor(
    private readonly verification: VerificationService,
    private readonly reports: ReportsService,
    private readonly support: SupportService,
    private readonly users: UsersService,
  ) {}

  @Roles("ADMIN", "SUPPORT_AGENT", "MODERATOR")
  @Get("ops/summary")
  @ApiOperation({ summary: "Operations KPI counts" })
  async summary(@CurrentUser() user: RequestAuthContext): Promise<OpsSummaryView> {
    assertOpsReadAccess(user.roles);
    const [pendingVerifications, openReports, openTickets, suspendedMembers] = await Promise.all([
      this.verification.countPending(),
      this.reports.countOpen(),
      this.support.countOpen(),
      this.users.countSuspended(),
    ]);
    return { pendingVerifications, openReports, openTickets, suspendedMembers };
  }

  @Roles("ADMIN", "SUPPORT_AGENT")
  @Get("staff")
  @ApiOperation({ summary: "Assignable support staff" })
  staff(@CurrentUser() user: RequestAuthContext): Promise<StaffMemberView[]> {
    assertOpsReadAccess(user.roles);
    return this.users.listStaff();
  }
}
