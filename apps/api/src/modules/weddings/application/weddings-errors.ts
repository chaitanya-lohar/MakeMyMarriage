import { HttpStatus } from '@nestjs/common';
import { AppException } from '../../../common/errors/app.exception.js';
import { weddingNotFound } from '../../workspace/index.js';

/** Wedding error responses (decision 0016). */
export const WeddingsErrors = {
  alreadyOwned: () =>
    new AppException({
      code: 'WEDDING_ALREADY_OWNED',
      message: 'You already have a wedding. Each account can own one wedding.',
      status: HttpStatus.CONFLICT,
    }),

  notFound: weddingNotFound,
};
