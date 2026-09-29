import { SetMetadata } from '@nestjs/common';

export const SKIP_ENVELOPE = Symbol('skipEnvelope');

/**
 * Opts a controller or handler out of the standard `{ data, meta }` envelope.
 * Reserved for infrastructure endpoints such as health checks.
 */
export const SkipEnvelope = (): MethodDecorator & ClassDecorator =>
  SetMetadata(SKIP_ENVELOPE, true);
