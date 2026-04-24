import type { Lead, Product, Sale } from "@/features/social-sales/types";

export const seedProducts: Product[] = [
  {
    id: "prod-aurora",
    name: "Lámpara LED Aurora",
    category: "Hogar",
    supplier: "Nova Imports",
    cost: 18_900,
    suggestedPrice: 39_900,
    estimatedMargin: 21_000,
    estimatedDeliveryDays: 5,
    riskLevel: "bajo",
    shortDescription: "Lámpara ambiental con 16 colores, control remoto y formato ideal para reels visuales.",
    status: "publicado",
    evaluation: {
      marginScore: 9,
      visualAppeal: 10,
      socialSellability: 9,
      returnRisk: 3,
      deliveryTime: 8,
      impulsePotential: 9,
      marketSaturation: 4,
      finalScore: 8.1,
      verdict: "alto_potencial"
    },
    createdAt: "2026-04-10T09:00:00.000Z",
    updatedAt: "2026-04-18T10:00:00.000Z"
  },
  {
    id: "prod-flex",
    name: "Organizador Flex de Auto",
    category: "Automóvil",
    supplier: "Trend Hub",
    cost: 11_500,
    suggestedPrice: 24_990,
    estimatedMargin: 13_490,
    estimatedDeliveryDays: 7,
    riskLevel: "medio",
    shortDescription: "Organizador plegable para maletero con compartimentos, enfoque práctico para Facebook y WhatsApp.",
    status: "aprobado",
    evaluation: {
      marginScore: 8,
      visualAppeal: 7,
      socialSellability: 8,
      returnRisk: 4,
      deliveryTime: 7,
      impulsePotential: 7,
      marketSaturation: 5,
      finalScore: 6.9,
      verdict: "prometedor"
    },
    createdAt: "2026-04-08T12:00:00.000Z",
    updatedAt: "2026-04-17T11:30:00.000Z"
  },
  {
    id: "prod-pulse",
    name: "Masajeador Pulse Mini",
    category: "Bienestar",
    supplier: "Market Bridge",
    cost: 22_000,
    suggestedPrice: 44_900,
    estimatedMargin: 22_900,
    estimatedDeliveryDays: 9,
    riskLevel: "alto",
    shortDescription: "Masajeador portátil recargable, muy atractivo para TikTok pero sensible a devoluciones.",
    status: "en_evaluacion",
    evaluation: {
      marginScore: 9,
      visualAppeal: 8,
      socialSellability: 9,
      returnRisk: 7,
      deliveryTime: 5,
      impulsePotential: 8,
      marketSaturation: 7,
      finalScore: 5.8,
      verdict: "riesgoso"
    },
    createdAt: "2026-04-14T14:00:00.000Z",
    updatedAt: "2026-04-19T09:45:00.000Z"
  }
];

export const seedLeads: Lead[] = [
  {
    id: "lead-sofia",
    name: "Sofía Muñoz",
    sourceChannel: "Instagram",
    productId: "prod-aurora",
    status: "interesado",
    contactDate: "2026-04-19",
    notes: "Pidió video del ambiente nocturno y consulta por stock inmediato.",
    createdAt: "2026-04-19T16:20:00.000Z",
    updatedAt: "2026-04-19T17:15:00.000Z"
  },
  {
    id: "lead-matias",
    name: "Matías Rojas",
    sourceChannel: "WhatsApp",
    productId: "prod-flex",
    status: "seguimiento",
    contactDate: "2026-04-18",
    notes: "Le interesa compra por dos unidades, pendiente confirmar despacho.",
    createdAt: "2026-04-18T13:40:00.000Z",
    updatedAt: "2026-04-18T15:00:00.000Z"
  },
  {
    id: "lead-carla",
    name: "Carla Díaz",
    sourceChannel: "Facebook",
    productId: "prod-aurora",
    status: "nuevo",
    contactDate: "2026-04-20",
    notes: "Escribió por DM preguntando si funciona por USB.",
    createdAt: "2026-04-20T10:10:00.000Z",
    updatedAt: "2026-04-20T10:10:00.000Z"
  }
];

export const seedSales: Sale[] = [
  {
    id: "sale-001",
    productId: "prod-aurora",
    channel: "Instagram",
    salePrice: 39_900,
    cost: 18_900,
    margin: 21_000,
    date: "2026-04-17",
    customerName: "Francisca Soto",
    notes: "Venta cerrada por historia con sticker de enlace.",
    createdAt: "2026-04-17T20:00:00.000Z",
    updatedAt: "2026-04-17T20:00:00.000Z"
  },
  {
    id: "sale-002",
    productId: "prod-flex",
    channel: "WhatsApp",
    salePrice: 24_990,
    cost: 11_500,
    margin: 13_490,
    date: "2026-04-19",
    customerName: "Rodrigo Vega",
    notes: "Cliente llegó desde grupo vecinal.",
    createdAt: "2026-04-19T18:00:00.000Z",
    updatedAt: "2026-04-19T18:00:00.000Z"
  }
];
