import { Rol } from "@prisma/client";

declare global {
  namespace Express {
    interface Request {
      usuario?: {
        id: string;
        rol: Rol;
        email: string;
      };
      requestId?: string;
    }
  }
}

export {};