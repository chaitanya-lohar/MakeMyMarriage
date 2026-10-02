// Public entry point of the users module (decision 0006).
export { UsersService } from './application/services/users.service.js';
export { UserDto } from './api/dto/user.dto.js';
export { normalizeEmail } from './domain/rules/email.js';
export { UserStatus } from './domain/enums/user-status.js';
export { EmailAlreadyRegisteredError } from './domain/types/user.js';
export type { NewUser, User, UserCredentials } from './domain/types/user.js';
export { UsersModule } from './users.module.js';
