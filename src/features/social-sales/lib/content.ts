import type { GeneratedContent, Product } from "@/features/social-sales/types";

export function generateProductContent(product: Product): GeneratedContent {
  const price = new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0
  }).format(product.suggestedPrice);

  return {
    instagramShort: `${product.name} llegó para resolver tu día con estilo. ${product.shortDescription} Disponible por ${price}.`,
    facebookLong: `${product.name} es una opción atractiva para quienes buscan ${product.category.toLowerCase()} sin complicarse. ${product.shortDescription} Precio sugerido: ${price}. Ideal para contenido demostrativo, beneficios rápidos y cierre por mensaje directo.`,
    whatsappPromo: `Hola, te comparto este destacado: ${product.name}. ${product.shortDescription} Está en ${price} y se ve muy bien para compra rápida. Si quieres, te envío más fotos o video.`,
    tiktokScript: `Gancho: "Si vendes por redes, mira esto". Mostrar el producto en uso en los primeros 3 segundos. Explicar el beneficio principal, mostrar detalle visual y cerrar con una pregunta directa para comentarios.`,
    callToAction: `Escríbeme “QUIERO ${product.name.toUpperCase()}” por DM o WhatsApp y te comparto stock y despacho.`,
    faq: [
      `¿Qué incluye ${product.name}? Incluye el producto principal listo para uso y soporte básico postventa.`,
      `¿Cuánto demora el despacho? Hoy estimamos ${product.estimatedDeliveryDays} días de entrega.`,
      `¿Para quién lo recomendarías? Para personas que valoran una solución práctica y visualmente atractiva.`
    ],
    objections: [
      `“Lo estoy pensando”: perfecto, te envío un video real para que veas cómo funciona antes de decidir.`,
      `“Se ve caro”: el valor incluye una mejor presentación, margen de durabilidad y una compra lista para usar.`,
      `“No sé si lo necesito”: te muestro en menos de un minuto cómo resuelve un problema cotidiano.`
    ]
  };
}
