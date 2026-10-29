import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { ValidationFailedException } from '../../../common/errors/validation-failed.exception.js';

/** Member error responses (API Design §7.1, §21). */
export const MembersErrors = {
  /** Missing, removed, malformed or in another wedding — never told apart. */
  notFound: () =>
    new AppException({
      code: 'MEMBER_NOT_FOUND',
      message: 'That person is not a member of this wedding.',
      status: HttpStatus.NOT_FOUND,
    }),

  invalidCursor: () => new ValidationFailedException({ cursor: ['The cursor is not valid.'] }),

  invalidOverrides: (problems: string[]) =>
    new ValidationFailedException({ permissionOverrides: problems }),
};
