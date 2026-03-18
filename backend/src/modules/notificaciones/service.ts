export type Canal = "email" | "whatsapp" | "push";

export async function enviarNotificacion(canal: Canal, destino: string, mensaje: string): Promise<void> {
  // Simulación para desarrollo: reemplazar por Twilio/SES en producción.
  console.log(JSON.stringify({
    tipo: "notificacion_simulada",
    canal,
    destino,
    mensaje,
    fecha: new Date().toISOString()
  }));
}