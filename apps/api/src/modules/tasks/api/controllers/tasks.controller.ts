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
import {
  PermissionAction,
  PermissionModule,
  RequirePermission,
  WeddingAccessGuard,
} from '../../../workspace/index.js';
import { TasksService } from '../../application/services/tasks.service.js';
import { ListTasksUseCase } from '../../application/use-cases/list-tasks.use-case.js';
import { SaveTaskUseCase } from '../../application/use-cases/save-task.use-case.js';
import { TaskAssigneesUseCase } from '../../application/use-cases/task-assignees.use-case.js';
import { DEFAULT_LIST_STATUSES, TaskPriority, TaskStatus } from '../../domain/rules/task-rules.js';
import type { Task, TaskChanges } from '../../domain/types/task.js';
import {
  AssignTaskDto,
  CreateTaskDto,
  ListTasksQueryDto,
  TaskActivityDto,
  TaskDto,
  UpdateTaskDto,
} from '../dto/task.dto.js';

const notFound = {
  status: 404,
  description: 'WEDDING_NOT_FOUND or TASK_NOT_FOUND — missing, deleted or not a member',
};

/** Wedding tasks (API Design §13, decision 0026, Phase 7 PRD). */
@ApiTags('Tasks')
@ApiCookieAuth('session')
@UseGuards(WeddingAccessGuard)
@Controller('weddings/:weddingId/tasks')
export class TasksController {
  constructor(
    private readonly tasks: TasksService,
    private readonly saveTask: SaveTaskUseCase,
    private readonly listTasks: ListTasksUseCase,
    private readonly assignees: TaskAssigneesUseCase,
  ) {}

  private async dto(weddingId: string, task: Task): Promise<TaskDto> {
    const [view, today] = await Promise.all([
      this.tasks.view(weddingId, task),
      this.tasks.today(weddingId),
    ]);
    return TaskDto.from(view, today);
  }

  @Get()
  @RequirePermission(PermissionModule.Tasks, PermissionAction.View)
  @ApiOperation({
    summary: 'List, filter and search tasks: by due date (undated last), then Urgent → Low',
  })
  @ApiPaginatedResponse(TaskDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED — invalid query or cursor' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, or EVENT_NOT_FOUND for the event filter' },
  )
  async list(
    @Param('weddingId') weddingId: string,
    @CurrentAuth() auth: RequestAuth,
    @Query() query: ListTasksQueryDto,
  ): Promise<Paginated<TaskDto>> {
    const today = await this.tasks.today(weddingId);
    const page = await this.listTasks.execute(weddingId, {
      statuses: query.status?.length ? query.status : [...DEFAULT_LIST_STATUSES],
      priority: query.priority,
      eventId: query.eventId,
      overdue: query.overdue === true,
      assignedTo: query.assignedToMe === true ? auth.userId : undefined,
      search: query.search ?? undefined,
      limit: query.limit,
      cursor: query.cursor,
      today,
    });
    const views = await this.tasks.views(weddingId, page.tasks);
    return new Paginated(
      views.map((view) => TaskDto.from(view, today)),
      page.nextCursor,
    );
  }

  @Post()
  @RequirePermission(PermissionModule.Tasks, PermissionAction.Create)
  @ApiOperation({ summary: 'Create a task; status TODO and priority MEDIUM by default' })
  @ApiEnvelopeResponse(201, TaskDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, EVENT_NOT_FOUND or MEMBER_NOT_FOUND' },
  )
  async create(
    @Param('weddingId') weddingId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: CreateTaskDto,
  ): Promise<TaskDto> {
    const task = await this.saveTask.create(
      weddingId,
      auth.userId,
      {
        title: body.title,
        description: body.description ?? null,
        notes: body.notes ?? null,
        status: body.status ?? TaskStatus.Todo,
        priority: body.priority ?? TaskPriority.Medium,
        dueDate: body.dueDate ?? null,
        eventId: body.eventId ?? null,
      },
      body.assigneeIds ?? [],
    );
    return this.dto(weddingId, task);
  }

  @Get(':taskId')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.View)
  @ApiOperation({ summary: 'Get a task' })
  @ApiEnvelopeResponse(200, TaskDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async get(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskDto> {
    return this.dto(weddingId, await this.tasks.getActive(weddingId, taskId));
  }

  @Patch(':taskId')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.Edit)
  @ApiOperation({
    summary: 'Update a task; null clears an optional field; any status may follow any other',
  })
  @ApiEnvelopeResponse(200, TaskDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    {
      status: 404,
      description: 'WEDDING_NOT_FOUND, TASK_NOT_FOUND, EVENT_NOT_FOUND or MEMBER_NOT_FOUND',
    },
  )
  async update(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: UpdateTaskDto,
  ): Promise<TaskDto> {
    const { assigneeIds, ...fields } = body;
    const changes: TaskChanges = { ...fields };
    const task = await this.saveTask.update(weddingId, taskId, auth.userId, changes, assigneeIds);
    return this.dto(weddingId, task);
  }

  @Delete(':taskId')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.Delete)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a task; its history is kept and the deletion audited' })
  @ApiEnvelopeResponse(204)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async delete(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<void> {
    await this.tasks.delete(weddingId, taskId, auth.userId);
  }

  @Post(':taskId/assignees')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.Edit)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign a wedding member; assigning them again changes nothing' })
  @ApiEnvelopeResponse(200, TaskDto)
  @ApiErrorResponses(
    { status: 400, description: 'VALIDATION_FAILED' },
    { status: 401, description: 'Not signed in' },
    { status: 404, description: 'WEDDING_NOT_FOUND, TASK_NOT_FOUND or MEMBER_NOT_FOUND' },
  )
  async assign(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
    @CurrentAuth() auth: RequestAuth,
    @Body() body: AssignTaskDto,
  ): Promise<TaskDto> {
    return this.dto(
      weddingId,
      await this.assignees.assign(weddingId, taskId, body.userId, auth.userId),
    );
  }

  @Delete(':taskId/assignees/:userId')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.Edit)
  @ApiOperation({ summary: 'Unassign a member; unassigning someone not assigned changes nothing' })
  @ApiEnvelopeResponse(200, TaskDto)
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async unassign(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
    @Param('userId') userId: string,
    @CurrentAuth() auth: RequestAuth,
  ): Promise<TaskDto> {
    return this.dto(
      weddingId,
      await this.assignees.unassign(weddingId, taskId, userId, auth.userId),
    );
  }

  @Get(':taskId/activities')
  @RequirePermission(PermissionModule.Tasks, PermissionAction.View)
  @ApiOperation({ summary: "The task's history, newest first" })
  @ApiEnvelopeResponse(200, [TaskActivityDto])
  @ApiErrorResponses({ status: 401, description: 'Not signed in' }, notFound)
  async history(
    @Param('weddingId') weddingId: string,
    @Param('taskId') taskId: string,
  ): Promise<TaskActivityDto[]> {
    const entries = await this.tasks.history(weddingId, taskId);
    return entries.map((entry) => TaskActivityDto.from(entry));
  }
}
