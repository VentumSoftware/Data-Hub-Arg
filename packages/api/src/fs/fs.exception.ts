import { HttpException, HttpStatus } from '@nestjs/common';

export class FileSystemException extends HttpException {
    constructor(message: string, statusCode: HttpStatus = HttpStatus.BAD_REQUEST) {
        super(  message, statusCode );
    }
}

export class DirectoryNotFoundException extends FileSystemException {
    constructor(path: string) {
        super(`Directory not found: ${path}`, HttpStatus.NOT_FOUND);
    }
}

export class PermissionDeniedException extends FileSystemException {
    constructor(path: string) {
        super(`Permission denied: ${path}`, HttpStatus.FORBIDDEN);
    }
}

export class FileAlreadyExistsException extends FileSystemException {
    constructor(path: string) {
        super(`File or directory already exists: ${path}`, HttpStatus.CONFLICT);
    }
}

export class ConnectionException extends FileSystemException {
    constructor(message: string) {
        super(`Connection error: ${message}`, HttpStatus.SERVICE_UNAVAILABLE);
    }
}
