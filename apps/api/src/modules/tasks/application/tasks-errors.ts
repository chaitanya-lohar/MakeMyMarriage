import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';

/** Task error responses (API Design §13). */
export const TasksErrors = {
  /** Missing, deleted or in another wedding — never told apart. */
  notFound: () =>
    new AppException({
      code: 'TASK_NOT_FOUND',
      message: 'The requested task was not found.',
      status: HttpStatus.NOT_FOUND,
    }),

  /** An assignee who is not an active member of the wedding (0026 #13). */
  memberNotFound: () =>
    new AppException({
      code: 'MEMBER_NOT_FOUND',
      message: 'That person is not a member of this wedding.',
      status: HttpStatus.NOT_FOUND,
    }),

  invalidCursor: () => new ValidationFailedException({ cursor: ['The cursor is not valid.'] }),
};
