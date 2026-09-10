import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { VotePermissionGuard } from './vote-permission.guard';

@Controller('votes')
export class VoteAuthorizationController {
  @Get(':voteId')
  @UseGuards(VotePermissionGuard)
  findOne(@Param('voteId') voteId: string) {
    return { id: voteId };
  }
}
