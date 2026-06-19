import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class AppError extends Error {
  constructor(public code: string, message: string, public status = 400, public details?: unknown) {
    super(message);
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return NextResponse.json({ code: error.code, message: error.message, details: error.details }, { status: error.status });
  }
  if (error instanceof ZodError) {
    return NextResponse.json({ code: "VALIDATION_ERROR", message: "Die Eingaben sind unvollständig oder ungültig.", details: error.issues }, { status: 422 });
  }
  console.error(error);
  return NextResponse.json({ code: "INTERNAL_ERROR", message: "Etwas ist schiefgelaufen. Bitte versuche es erneut." }, { status: 500 });
}
