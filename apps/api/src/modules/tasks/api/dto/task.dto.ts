import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { trim, trimToNull } from '../../../../common/http/dto-transforms.js';
import { IsRequiredText, Matches } from '../../../../common/http/dto-validators.js';
import { isCalendarDate } from '../../../weddings/index.js';
import {
  isDueToday,
  isOverdue,
  TASK_PRIORITIES,
  TASK_STATUSES,
  TaskLimits,
  TaskMessages,
  TaskPriority,
  TaskStatus,
} from '../../domain/rules/task-rules.js';
import { TaskActivityAction, type TaskView } from '../../domain/types/task.js';
import type { TaskActivityView } from '../../application/services/tasks.service.js';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;
const MAX_ASSIGNEES = 50;

const dateDoc = {
  type: String,
  format: 'date',
  nullable: true,
  example: '2027-02-12',
  description: 'YYYY-MM-DD in the wedding timezone; never a time. Past dates are allowed.',
};

/** Query booleans arrive as text; only `true` turns a filter on. */
const toBoolean = ({ value }: { value: unknown }): unknown =>
  value === true || value === 'true' ? true : value === false || value === 'false' ? false : value;

/** A repeatable query parameter arrives as one value or several. */
const toArray = ({ value }: { value: unknown }): unknown =>
  value === undefined || Array.isArray(value) ? value : [value];

/** Optional fields shared by create and update; null clears a field. */
class TaskOptionalFields {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: TaskLimits.descriptionMaxLength })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(TaskLimits.descriptionMaxLength, {
    message: TaskMessages.tooLong(TaskLimits.descriptionMaxLength),
  })
  description?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    maxLength: TaskLimits.notesMaxLength,
    description: 'One editable field, separate from the description and the history.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(TaskLimits.notesMaxLength, {
    message: TaskMessages.tooLong(TaskLimits.notesMaxLength),
  })
  notes?: string | null;

  @ApiPropertyOptional(dateDoc)
  @Transform(trimToNull)
  @IsOptional()
  @Matches(isCalendarDate, TaskMessages.dueDate)
  dueDate?: string | null;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'An active event of the wedding; null for a whole-wedding task.',
  })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  eventId?: string | null;

  @ApiPropertyOptional({
    type: [String],
    description:
      'The complete set of assignees: active members of the wedding (user IDs). Omit to ' +
      'leave assignees unchanged.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_ASSIGNEES)
  @IsString({ each: true })
  assigneeIds?: string[];
}

/** POST /weddings/{weddingId}/tasks (API Design §13). */
export class CreateTaskDto extends TaskOptionalFields {
  @ApiProperty({ example: 'Book mehendi artist', maxLength: TaskLimits.titleMaxLength })
  @Transform(trim)
  @IsRequiredText(TaskLimits.titleMaxLength, TaskMessages.title, TaskMessages.titleTooLong)
  title!: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES, default: TaskStatus.Todo })
  @IsOptional()
  @IsIn(TASK_STATUSES, { message: TaskMessages.status })
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES, default: TaskPriority.Medium })
  @IsOptional()
  @IsIn(TASK_PRIORITIES, { message: TaskMessages.priority })
  priority?: TaskPriority;
}

/** PATCH /weddings/{weddingId}/tasks/{taskId}: send only the fields that change. */
export class UpdateTaskDto extends TaskOptionalFields {
  @ApiPropertyOptional({ example: 'Book mehendi artist', maxLength: TaskLimits.titleMaxLength })
  @Transform(trim)
  @ValidateIf((dto: UpdateTaskDto) => dto.title !== undefined)
  @IsRequiredText(TaskLimits.titleMaxLength, TaskMessages.title, TaskMessages.titleTooLong)
  title?: string;

  @ApiPropertyOptional({ enum: TASK_STATUSES })
  @ValidateIf((dto: UpdateTaskDto) => dto.status !== undefined)
  @IsIn(TASK_STATUSES, { message: TaskMessages.status })
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @ValidateIf((dto: UpdateTaskDto) => dto.priority !== undefined)
  @IsIn(TASK_PRIORITIES, { message: TaskMessages.priority })
  priority?: TaskPriority;
}

/** POST /weddings/{weddingId}/tasks/{taskId}/assignees. */
export class AssignTaskDto {
  @ApiProperty({ description: 'An active member of the wedding (user ID).' })
  @IsString()
  userId!: string;
}

/** GET /weddings/{weddingId}/tasks query (API Design §13, §24). */
export class ListTasksQueryDto {
  @ApiPropertyOptional({
    enum: TASK_STATUSES,
    isArray: true,
    description: 'Repeatable. Default: every status except CANCELLED.',
  })
  @Transform(toArray)
  @IsOptional()
  @IsIn(TASK_STATUSES, { each: true })
  status?: TaskStatus[];

  @ApiPropertyOptional({ enum: TASK_PRIORITIES })
  @IsOptional()
  @IsIn(TASK_PRIORITIES)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'An event ID, or `none` for whole-wedding tasks.' })
  @IsOptional()
  @IsString()
  eventId?: string;

  @ApiPropertyOptional({ type: Boolean, description: 'Only overdue tasks.' })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  overdue?: boolean;

  @ApiPropertyOptional({ type: Boolean, description: 'Only tasks assigned to the signed-in user.' })
  @Transform(toBoolean)
  @IsOptional()
  @IsBoolean()
  assignedToMe?: boolean;

  @ApiPropertyOptional({ type: String, description: 'Title contains the text, ignoring case.' })
  @Transform(trimToNull)
  @IsOptional()
  @IsString()
  @MaxLength(TaskLimits.titleMaxLength)
  search?: string | null;

  @ApiPropertyOptional({ minimum: 1, maximum: MAX_PAGE_SIZE, default: DEFAULT_PAGE_SIZE })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_PAGE_SIZE)
  limit: number = DEFAULT_PAGE_SIZE;

  @ApiPropertyOptional({ description: '`meta.pagination.nextCursor` of the previous page.' })
  @IsOptional()
  @IsString()
  cursor?: string;
}

export class TaskAssigneeDto {
  @ApiProperty()
  userId!: string;

  @ApiProperty({ example: 'Meera Sharma' })
  displayName!: string;
}

/** A task as returned to organizers (API Design §13). */
export class TaskDto {
  @ApiProperty({ example: '6650f0c2a1b2c3d4e5f60801' })
  id!: string;

  @ApiProperty({ example: 'Book mehendi artist' })
  title!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, nullable: true })
  notes!: string | null;

  @ApiProperty({ enum: TASK_STATUSES })
  status!: TaskStatus;

  @ApiProperty({ enum: TASK_PRIORITIES })
  priority!: TaskPriority;

  @ApiProperty(dateDoc)
  dueDate!: string | null;

  @ApiProperty({ type: String, nullable: true, description: 'Null for a whole-wedding task.' })
  eventId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Mehendi' })
  eventName!: string | null;

  @ApiProperty({ type: [TaskAssigneeDto] })
  assignees!: TaskAssigneeDto[];

  @ApiProperty({ description: 'Due before today (wedding timezone) and not closed (0026 #8).' })
  isOverdue!: boolean;

  @ApiProperty({ description: 'Due today and not closed: shown as "Due today".' })
  isDueToday!: boolean;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ format: 'date-time' })
  updatedAt!: string;

  static from(view: TaskView, today: string): TaskDto {
    const { task } = view;
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      notes: task.notes,
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate,
      eventId: task.eventId,
      eventName: view.eventName,
      assignees: view.assignees.map((assignee) => ({ ...assignee })),
      isOverdue: isOverdue(task.dueDate, task.status, today),
      isDueToday: isDueToday(task.dueDate, task.status, today),
      createdAt: task.createdAt.toISOString(),
      updatedAt: task.updatedAt.toISOString(),
    };
  }
}

/** One history entry (Phase 7 PRD §5.5). */
export class TaskActivityDto {
  @ApiProperty()
  id!: string;

  @ApiProperty({ enum: Object.values(TaskActivityAction) })
  action!: TaskActivityAction;

  @ApiProperty()
  actorUserId!: string;

  @ApiProperty({ example: 'Meera Sharma' })
  actorName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    description: 'For ASSIGNEE_ADDED and ASSIGNEE_REMOVED: the person assigned or unassigned.',
  })
  subjectName!: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Values before the change, by field; long texts are not copied.',
  })
  oldValue!: Record<string, unknown> | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Values after the change, by field. UPDATED lists edited long texts in `fields`.',
  })
  newValue!: Record<string, unknown> | null;

  @ApiProperty({ format: 'date-time' })
  createdAt!: string;

  static from({ activity, actorName, subjectName }: TaskActivityView): TaskActivityDto {
    return {
      id: activity.id,
      action: activity.action,
      actorUserId: activity.actorUserId,
      actorName,
      subjectName,
      oldValue: activity.oldValue,
      newValue: activity.newValue,
      createdAt: activity.createdAt.toISOString(),
    };
  }
}
