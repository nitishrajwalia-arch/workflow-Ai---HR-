/**
 * Every route, in one place.
 *
 * Registered under /api/v1 by app.ts. The version prefix is not decoration: when
 * a breaking change is needed, /api/v2 can be added alongside and the old client
 * keeps working while it is updated.
 */

import type { FastifyInstance } from 'fastify';
import { authRoutes } from './modules/auth.routes.js';
import { bootstrapRoutes } from './modules/bootstrap.routes.js';
import { cardsRoutes } from './modules/cards.routes.js';
import { documentsRoutes } from './modules/documents.routes.js';
import { exitsRoutes } from './modules/exits.routes.js';
import { gateRoutes } from './modules/gate.routes.js';
import { importsRoutes } from './modules/imports.routes.js';
import { ledgerRoutes } from './modules/ledger.routes.js';
import { moneyRoutes } from './modules/money.routes.js';
import { orgRoutes } from './modules/org.routes.js';
import { payrollRoutes } from './modules/payroll.routes.js';
import { peopleRoutes } from './modules/people.routes.js';
import { platformRoutes } from './modules/platform.routes.js';
import { procurementRoutes } from './modules/procurement.routes.js';
import { policiesRoutes } from './modules/policies.routes.js';
import { uploadsRoutes } from './modules/uploads.routes.js';
import { usageRoutes } from './modules/usage.routes.js';

export async function registerRoutes(app: FastifyInstance) {
  await app.register(authRoutes);
  await app.register(bootstrapRoutes);
  await app.register(peopleRoutes);
  await app.register(orgRoutes);
  await app.register(cardsRoutes);
  await app.register(ledgerRoutes);
  await app.register(exitsRoutes);
  await app.register(payrollRoutes);
  await app.register(policiesRoutes);
  await app.register(documentsRoutes);
  await app.register(importsRoutes);
  await app.register(usageRoutes);
  await app.register(uploadsRoutes);

  // MarbellaProcurementOS.jsx: buying, the gate, money and the platform.
  await app.register(procurementRoutes);
  await app.register(gateRoutes);
  await app.register(moneyRoutes);
  await app.register(platformRoutes);
}
