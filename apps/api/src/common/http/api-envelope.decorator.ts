import { applyDecorators, type Type } from '@nestjs/common';
import {
  ApiExtraModels,
  ApiProperty,
  ApiResponse,
  getSchemaPath,
  type ApiResponseOptions,
} from '@nestjs/swagger';

export class ResponseMetaDto {
  @ApiProperty({ example: 'req_3f2a…' })
  requestId!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}

export class ErrorBodyDto {
  @ApiProperty({ example: 'VALIDATION_FAILED' })
  code!: string;

  @ApiProperty()
  message!: string;

  @ApiProperty({ type: 'object', additionalProperties: true })
  details!: Record<string, unknown>;

  @ApiProperty()
  requestId!: string;
}

export class ErrorResponseDto {
  @ApiProperty({ type: ErrorBodyDto })
  error!: ErrorBodyDto;
}

/**
 * Documents a success response wrapped in the standard `{ data, meta }` envelope
 * (API Design §20). Pass `[Model]` when `data` is a list; omit `model` for responses whose
 * `data` is null.
 */
export function ApiEnvelopeResponse(
  status: number,
  model?: Type<unknown> | [Type<unknown>],
  description?: string,
) {
  const item = Array.isArray(model) ? model[0] : model;
  // OpenAPI 3.0 has no `null` type; an empty payload is a nullable schema that is always null.
  const data = !item
    ? { nullable: true, example: null, description: 'Always null.' }
    : Array.isArray(model)
      ? { type: 'array', items: { $ref: getSchemaPath(item) } }
      : { $ref: getSchemaPath(item) };
  const decorators = [
    ApiExtraModels(ResponseMetaDto, ...(item ? [item] : [])),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        required: ['data', 'meta'],
        properties: { data, meta: { $ref: getSchemaPath(ResponseMetaDto) } },
      },
    }),
  ];
  return applyDecorators(...decorators);
}

/** Documents error responses in the standard error contract (API Design §21). */
export function ApiErrorResponses(
  ...responses: Pick<ApiResponseOptions, 'status' | 'description'>[]
) {
  return applyDecorators(
    ...responses.map((response) => ApiResponse({ ...response, type: ErrorResponseDto })),
  );
}
