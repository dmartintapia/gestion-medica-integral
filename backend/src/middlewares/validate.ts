import { NextFunction, Request, Response } from "express";
import { z } from "zod";

export function validar(schema: z.ZodTypeAny) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      res.status(400).json({
        code: "VALIDATION_ERROR",
        message: "Payload inválido",
        details: result.error.issues
      });
      return;
    }
    req.body = result.data;
    next();
  };
}