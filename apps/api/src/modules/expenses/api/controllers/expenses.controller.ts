import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentAuth, type RequestAuth } from '../../../../common/auth/request-auth.js';
import {
  ApiEnvelopeResponse,
  ApiErrorResponses,
  ApiPaginatedResponse,
} from '../../../../common/http/api-envelope.decorator.js';
import { Paginated } from '../../../../common/http/paginated.js';
import { WeddingAccessGuard } from '../../../workspace/index.js';
import { ExpensesService } from '../../application/services/expenses.service.js';
import { ExpensePaymentsUseCase } from '../../application/use-cases/expense-payments.use-case.js';
import { ListExpensesUseCase } from '../../application/use-cases/list-expenses.use-case.js';
import { SaveExpenseUseCase } from '../../application/use-cases/save-expense.use-case.js';
import { PayerType } from '../../domain/rules/expense-rules.js';
import type { Expense, ExpensePayment, PaymentDetails } from '../../domain/types/expense.js';
import {
  CreateExpenseDto,
  ExpenseDto,
  ExpenseListMetaDto,
  ListExpensesQueryDto,
  PaymentDto,
  SavePaymentDto,
  UpdateExpenseDto,
} from '../dto/expense.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or EXPENSE_NOT_FOUND — missing, deleted or not a member',
};

const paymentNotFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND, EXPENSE_NOT_FOUND or PAYMENT_NOT_FOUND',
};

function paymentDetails(body: SavePaymentDto): PaymentDetails {
  const member = body.paidByType === PayerType.WeddingMember;
  return {
    amountMinor: body.amountMinor,
    paymentDate: body.paymentDate,
    payer: {
      type: body.paidByType,
      userId: member ? (body.paidByUserId ?? null) : null,
      name: member ? null : (body.paidByName ?? null),
    },
    method: body.paymentMethod ?? null,
    referenceNumber: body.referenceNumber ?? null,
    notes: body.notes ?? null,
  };
}

/** Wedding expenses and their payments (API Design §12, decision 0028, Phase 8 PRD). */
@ApiTags('Expenses')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/expenses')
export class ExpensesController {
  constructor(
    private readonly expenses: ExpensesService,
    private readonly saveExpense: SaveExpenseUseCase,
    private readonly listExpenses: ListExpensesUseCase,
    private readonly payments: ExpensePaymentsUseCase,
  ) {}

  private async dto(weddingId: string, expense: Expense): Promise<ExpenseDto> {
    return ExpenseDto.from(await this.expenses.view(weddingId, expense));
  }

  private async paymentDto(payment: ExpensePayment): Promise<PaymentDto> {
    const [view] = await this.expenses.paymentViews([payment]);
    return PaymentDto.from(view!);
  }

  @Get()
  @ApiOperation({
    summary: 'List, filter and search expenses, newest first, with totals for the filters',
  })
  @ApiPaginatedResponse(ExpenseDto, ExpenseListMetaDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, or EVENT_NOT_FOUND for the event filter' },
  )
  async list(
    @Param('weddingId') weddingId: string,
    @Query() query: ListExpensesQueryDto,
  ): Promise<Paginated<ExpenseDto>> {
    const page = await this.listExpenses.execute(weddingId, {
      category: query.category,
      eventId: query.eventId,
      paymentStatus: query.paymentStatus,
      search: query.search ?? undefined,
      limit: query.limit,
      cursor: query.cursor,
    });
    const views = await this.expenses.views(weddingId, page.expenses);
    return new Paginated(
      views.map((view) => ExpenseDto.from(view)),
      page.nextCursor,
      { totals: page.totals },
    );
  }

  @Post()
  @ApiOperation({ summary: 'Create an expense; it starts PENDING with nothing paid' })
  @ApiEnvelopeResponse(201, ExpenseDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND or EVENT_NOT_FOUND' },
  )
  async create(
    @Param('weddingId') weddingId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateExpenseDto,
  ): Promise<ExpenseDto> {
    const expense = await this.saveExpense.create(weddingId, auth.userId, {
      title: body.title,
      amountMinor: body.amountMinor,
      category: body.category,
      expenseDate: body.expenseDate,
      eventId: body.eventId ?? null,
      notes: body.notes ?? null,
    });
    return this.dto(weddingId, expense);
  }

  @Get(':expenseId')
  @ApiOperation({ summary: 'Get an expense' })
  @ApiEnvelopeResponse(200, ExpenseDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async get(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
  ): Promise<ExpenseDto> {
    return this.dto(weddingId, await this.expenses.getActive(weddingId, expenseId));
  }

  @Patch(':expenseId')
  @ApiOperation({ summary: 'Update an expense; null clears an optional field' })
  @ApiEnvelopeResponse(200, ExpenseDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, EXPENSE_NOT_FOUND or EVENT_NOT_FOUND' },
    { status: 409, description: 'AMOUNT_BELOW_PAID — the amount would be below the paid total' },
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: UpdateExpenseDto,
  ): Promise<ExpenseDto> {
    const expense = await this.saveExpense.update(weddingId, expenseId, auth.userId, {
      ...body,
    });
    return this.dto(weddingId, expense);
  }

  @Delete(':expenseId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete an expense; it and its payments are kept, and audited' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async delete(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.expenses.delete(weddingId, expenseId, auth.userId);
  }

  @Get(':expenseId/payments')
  @ApiOperation({ summary: "The expense's payments, oldest first" })
  @ApiEnvelopeResponse(200, [PaymentDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async listPayments(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
  ): Promise<PaymentDto[]> {
    const payments = await this.payments.list(weddingId, expenseId);
    const views = await this.expenses.paymentViews(payments);
    return views.map((view) => PaymentDto.from(view));
  }

  @Post(':expenseId/payments')
  @ApiOperation({ summary: 'Add a payment; the paid total and status update with it' })
  @ApiEnvelopeResponse(201, PaymentDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED (including a payment date in the future)' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, EXPENSE_NOT_FOUND or MEMBER_NOT_FOUND' },
    { status: 409, description: 'PAYMENT_EXCEEDS_BALANCE — more than the pending amount' },
  )
  async addPayment(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: SavePaymentDto,
  ): Promise<PaymentDto> {
    return this.paymentDto(
      await this.payments.add(weddingId, expenseId, auth.userId, paymentDetails(body)),
    );
  }

  @Patch(':expenseId/payments/:paymentId')
  @ApiOperation({ summary: "Replace a payment's details; the paid total and status update" })
  @ApiEnvelopeResponse(200, PaymentDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED (including a payment date in the future)' },
    { status: 401, description: 'Not signed in' },
    { ...paymentNotFound, description: `${paymentNotFound.description} or MEMBER_NOT_FOUND` },
    { status: 409, description: 'PAYMENT_EXCEEDS_BALANCE — more than the pending amount' },
  )
  async updatePayment(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
    @Param('paymentId') paymentId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: SavePaymentDto,
  ): Promise<PaymentDto> {
    return this.paymentDto(
      await this.payments.update(
        weddingId,
        expenseId,
        paymentId,
        auth.userId,
        paymentDetails(body),
      ),
    );
  }

  @Delete(':expenseId/payments/:paymentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a payment; the audit entry keeps its details' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, paymentNotFound)
  async removePayment(
    @Param('weddingId') weddingId: string,
    @Param('expenseId') expenseId: string,
    @Param('paymentId') paymentId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.payments.remove(weddingId, expenseId, paymentId, auth.userId);
  }
}
