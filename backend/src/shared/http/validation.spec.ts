import { ArgumentMetadata } from '@nestjs/common';
import { IsInt, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import {
  createValidationPipe,
  RequestValidationError,
  toFieldErrors,
} from './validation';

class SampleAddressDto {
  @IsString()
  city!: string;
}

class SampleDto {
  @IsInt()
  seats!: number;

  @ValidateNested()
  @Type(() => SampleAddressDto)
  address!: SampleAddressDto;
}

const BODY_METADATA: ArgumentMetadata = { type: 'body', metatype: SampleDto };

describe('validation', () => {
  const pipe = createValidationPipe();

  async function validationErrorOf(
    body: object,
  ): Promise<RequestValidationError> {
    return pipe.transform(body, BODY_METADATA).catch((error: unknown) => {
      expect(error).toBeInstanceOf(RequestValidationError);
      return error as RequestValidationError;
    }) as Promise<RequestValidationError>;
  }

  it('lets a valid body through as an instance of the DTO', async () => {
    const dto: unknown = await pipe.transform(
      { seats: 3, address: { city: 'Almería' } },
      BODY_METADATA,
    );

    expect(dto).toBeInstanceOf(SampleDto);
  });

  it('reports every invalid field, including nested ones', async () => {
    const error = await validationErrorOf({
      seats: 'three',
      address: { city: 42 },
    });

    expect(error.fields).toEqual([
      { field: 'seats', reason: 'seats must be an integer number' },
      { field: 'address.city', reason: 'city must be a string' },
    ]);
  });

  it('rejects fields the DTO does not declare', async () => {
    const error = await validationErrorOf({
      seats: 3,
      address: { city: 'Almería' },
      isAdmin: true,
    });

    expect(error.fields).toEqual([
      { field: 'isAdmin', reason: 'property isAdmin should not exist' },
    ]);
  });

  it('returns no fields for an empty list of errors', () => {
    expect(toFieldErrors([])).toEqual([]);
  });
});
