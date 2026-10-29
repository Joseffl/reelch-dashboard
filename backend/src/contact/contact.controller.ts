import { Inject, Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { Public, Roles } from '../auth/auth.decorators.js';
import { ContactService, type CreateContactEnquiryInput } from './contact.service.js';

@Controller('contact')
export class ContactController {
  constructor(@Inject(ContactService) private readonly contact: ContactService) {}

  @Post()
  @Public()
  create(@Body() body: CreateContactEnquiryInput) {
    return this.contact.create(body);
  }

  @Get('admin')
  @Roles('admin')
  list(@Query() query: { status?: string; query?: string; page?: number; pageSize?: number }) {
    return this.contact.list(query);
  }

  @Patch('admin/:id/status')
  @Roles('admin')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.contact.updateStatus(id, body.status);
  }
}
