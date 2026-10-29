import { Inject, BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { DatabaseService } from '../database/database.service.js';
import { contactEnquiries } from '../database/schema/index.js';

export type CreateContactEnquiryInput = {
  fullName?: string;
  email?: string;
  phone?: string;
  company?: string;
  enquiryType?: string;
  subject?: string;
  message?: string;
};

const enquiryTypes = ['business', 'promoter', 'support', 'partnership', 'other'];
const statuses = ['new', 'in_progress', 'resolved', 'spam'];

@Injectable()
export class ContactService {
  constructor(@Inject(DatabaseService) private readonly database: DatabaseService) {}

  async create(input: CreateContactEnquiryInput) {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const phone = input.phone?.trim() || null;
    const company = input.company?.trim() || null;
    const enquiryType = input.enquiryType?.trim().toLowerCase();
    const subject = input.subject?.trim();
    const message = input.message?.trim();

    if (!fullName || !email || !enquiryType || !subject || !message) throw new BadRequestException('Complete all required contact fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('Enter a valid email address');
    if (!enquiryTypes.includes(enquiryType)) throw new BadRequestException('Select a valid enquiry type');
    if (fullName.length > 120 || email.length > 254 || (phone?.length ?? 0) > 40 || (company?.length ?? 0) > 160) throw new BadRequestException('One or more contact fields are too long');
    if (subject.length < 3 || subject.length > 180) throw new BadRequestException('Subject must be between 3 and 180 characters');
    if (message.length < 20 || message.length > 5000) throw new BadRequestException('Message must be between 20 and 5,000 characters');

    const [entry] = await this.database.db.insert(contactEnquiries).values({ fullName, email, phone, company, enquiryType, subject, message }).returning({ id: contactEnquiries.id });
    return { message: 'Thanks for contacting Reelch. Your message has been received.', entry };
  }

  async list(input: { status?: string; query?: string; page?: number; pageSize?: number }) {
    const page = Math.max(1, Number(input.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(input.pageSize) || 25));
    const status = input.status?.trim();
    const query = input.query?.trim();
    const filters = [];
    if (status && status !== 'all') filters.push(eq(contactEnquiries.status, status));
    if (query) filters.push(or(ilike(contactEnquiries.fullName, `%${query}%`), ilike(contactEnquiries.email, `%${query}%`), ilike(contactEnquiries.company, `%${query}%`), ilike(contactEnquiries.subject, `%${query}%`))!);
    const where = filters.length ? and(...filters) : undefined;
    const [items, countRows, statusRows] = await Promise.all([
      this.database.db.select().from(contactEnquiries).where(where).orderBy(desc(contactEnquiries.createdAt)).limit(pageSize).offset((page - 1) * pageSize),
      this.database.db.select({ total: sql<number>`count(*)::int` }).from(contactEnquiries).where(where),
      this.database.db.select({ status: contactEnquiries.status, total: sql<number>`count(*)::int` }).from(contactEnquiries).groupBy(contactEnquiries.status),
    ]);
    const total = countRows[0]?.total ?? 0;
    return { items, counts: Object.fromEntries(statusRows.map(row => [row.status, row.total])), pagination: { page, pageSize, total, pages: Math.ceil(total / pageSize) } };
  }

  async updateStatus(id: string, status: string) {
    if (!statuses.includes(status)) throw new BadRequestException('Select a valid enquiry status');
    const [entry] = await this.database.db.update(contactEnquiries).set({ status, updatedAt: new Date() }).where(eq(contactEnquiries.id, id)).returning();
    if (!entry) throw new NotFoundException('Contact enquiry not found');
    return entry;
  }
}
