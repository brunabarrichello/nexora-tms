import { Body, Controller, Get, Param, Post } from '@nestjs/common';

import { TenantAuthorized } from '../security/tenant-authorized.decorator.js';
import {
  NegotiationCollaborationService,
  type NegotiationMessage,
  type NegotiationParticipant,
  type NegotiationThread,
} from './negotiation-collaboration.service.js';

@Controller('api/v1/negotiation')
@TenantAuthorized('negotiation.read')
export class NegotiationCollaborationController {
  constructor(private readonly collaboration: NegotiationCollaborationService) {}

  @Get('requests/:requestId/threads')
  listThreads(@Param('requestId') requestId: string): Promise<readonly NegotiationThread[]> {
    return this.collaboration.listThreads(requestId);
  }

  @Post('requests/:requestId/threads')
  @TenantAuthorized('negotiation.write')
  createThread(
    @Param('requestId') requestId: string,
    @Body() body: unknown,
  ): Promise<NegotiationThread> {
    return this.collaboration.createThread(requestId, body);
  }

  @Get('threads/:threadId')
  getThread(@Param('threadId') threadId: string): Promise<NegotiationThread> {
    return this.collaboration.getThread(threadId);
  }

  @Post('threads/:threadId/status')
  @TenantAuthorized('negotiation.write')
  setThreadStatus(
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ): Promise<NegotiationThread> {
    return this.collaboration.setThreadStatus(threadId, body);
  }

  @Get('threads/:threadId/participants')
  listParticipants(
    @Param('threadId') threadId: string,
  ): Promise<readonly NegotiationParticipant[]> {
    return this.collaboration.listParticipants(threadId);
  }

  @Post('threads/:threadId/participants')
  @TenantAuthorized('negotiation.write')
  addParticipant(
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ): Promise<NegotiationParticipant> {
    return this.collaboration.addParticipant(threadId, body);
  }

  @Post('threads/:threadId/participants/:participantId/remove')
  @TenantAuthorized('negotiation.write')
  removeParticipant(
    @Param('threadId') threadId: string,
    @Param('participantId') participantId: string,
  ): Promise<NegotiationParticipant> {
    return this.collaboration.removeParticipant(threadId, participantId);
  }

  @Get('threads/:threadId/messages')
  listMessages(@Param('threadId') threadId: string): Promise<readonly NegotiationMessage[]> {
    return this.collaboration.listMessages(threadId);
  }

  @Post('threads/:threadId/messages')
  @TenantAuthorized('negotiation.write')
  createMessage(
    @Param('threadId') threadId: string,
    @Body() body: unknown,
  ): Promise<NegotiationMessage> {
    return this.collaboration.createMessage(threadId, body);
  }
}
