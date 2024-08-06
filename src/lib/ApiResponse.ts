const BAD_REQUEST = 400;
const OK = 200;
const INTERNAL_SERVER_ERROR = 500;
const UNAUTHORIZED = 401;

export class ApiResponse {
	body: string;
	statusCode: number;
	headers: { 'Content-Type': string };

	constructor(status: number, message: string) {
		const body = { message: message };
		this.body = JSON.stringify(body);
		this.statusCode = status;
		this.headers = { 'Content-Type': 'application/json' };
	}
}

export type Files = { name: string; id: string }[];

export class SuccessResponse extends ApiResponse {
	constructor(files: Files) {
		super(OK, 'ok');
		const body = {
			message: 'ok',
			files: files,
		};
		this.body = JSON.stringify(body);
	}
}

export const serverError = new ApiResponse(
	INTERNAL_SERVER_ERROR,
	'Unexpected server error',
);
export const unauthorizedError = new ApiResponse(UNAUTHORIZED, 'Unauthorized');
export function badRequest(reason: string) {
	return new ApiResponse(BAD_REQUEST, reason);
}
