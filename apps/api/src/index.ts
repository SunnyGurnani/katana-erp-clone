import 'express-async-errors';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { env } from './env';
import { auditMiddleware } from './middleware/audit';
import { errorHandler } from './middleware/error';
import authRouter from './routes/auth';
import productsRouter from './routes/products';
import materialsRouter from './routes/materials';
import suppliersRouter from './routes/suppliers';
import customersRouter from './routes/customers';
import locationsRouter from './routes/locations';
import inventoryRouter from './routes/inventory';
import purchaseOrdersRouter from './routes/purchaseOrders';
import salesOrdersRouter from './routes/salesOrders';
import manufacturingRouter from './routes/manufacturing';
import stockOpsRouter from './routes/stockOps';
import apiKeysRouter from './routes/apiKeys';
import webhooksRouter from './routes/webhooks';
import dashboardRouter from './routes/dashboard';
import taxRatesRouter from './routes/taxRates';
import supplierAddressesRouter from './routes/supplierAddresses';
import customerAddressesRouter from './routes/customerAddresses';
import priceListsRouter from './routes/priceLists';
import servicesRouter from './routes/services';
import salesReturnsRouter from './routes/salesReturns';
import shippingFeesRouter from './routes/shippingFees';
import demandForecastRouter from './routes/demandForecast';
import factoryRouter from './routes/factory';
import currenciesRouter from './routes/currencies';
import accountingRouter from './routes/accounting';
import ecommerceRouter from './routes/ecommerce';
import barcodesRouter from './routes/barcodes';
import customFieldsRouter from './routes/customFields';
import batchesRouter from './routes/batches';
import serialNumbersRouter from './routes/serialNumbers';
import binLocationsRouter from './routes/binLocations';
import usersRouter from './routes/users';
import additionalCostsRouter from './routes/additionalCosts';
import outsourcedPORouter from './routes/outsourcedPO';
import accountingMetadataRouter from './routes/accountingMetadata';
import quotesRouter from './routes/quotes';
import insightsRouter from './routes/insights';
import planningRouter from './routes/planning';

const app = express();

app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS.split(',').map(s => s.trim()), credentials: true }));
app.use(express.json());
app.use(morgan('dev'));
app.use(auditMiddleware);

app.get('/health', (_req, res) => res.json({ status: 'ok', app: 'ForgeERP' }));

const swaggerSpec = swaggerJsdoc({
  definition: {
    openapi: '3.0.0',
    info: { title: 'ForgeERP API', version: '1.0.0', description: 'Manufacturing ERP REST API' },
    servers: [{ url: '/api/v1' }],
    components: {
      securitySchemes: { bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    },
    security: [{ bearerAuth: [] }],
  },
  apis: [],
});
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const v1 = '/api/v1';
app.use(`${v1}/auth`, authRouter);
app.use(`${v1}/products`, productsRouter);
app.use(`${v1}/materials`, materialsRouter);
app.use(`${v1}/suppliers`, suppliersRouter);
app.use(`${v1}/customers`, customersRouter);
app.use(`${v1}/locations`, locationsRouter);
app.use(`${v1}/inventory`, inventoryRouter);
app.use(`${v1}/purchase-orders`, purchaseOrdersRouter);
app.use(`${v1}/sales-orders`, salesOrdersRouter);
app.use(`${v1}/manufacturing`, manufacturingRouter);
app.use(`${v1}/stock`, stockOpsRouter);
app.use(`${v1}/api-keys`, apiKeysRouter);
app.use(`${v1}/webhooks`, webhooksRouter);
app.use(`${v1}/dashboard`, dashboardRouter);
app.use(`${v1}/tax-rates`, taxRatesRouter);
app.use(v1, supplierAddressesRouter);
app.use(v1, customerAddressesRouter);
app.use(`${v1}/price-lists`, priceListsRouter);
app.use(`${v1}/services`, servicesRouter);
app.use(`${v1}/sales-returns`, salesReturnsRouter);
app.use(v1, shippingFeesRouter);
app.use(`${v1}/demand-forecast`, demandForecastRouter);
app.use(`${v1}/factory`, factoryRouter);
app.use(`${v1}/currencies`, currenciesRouter);
app.use(`${v1}/accounting`, accountingRouter);
app.use(`${v1}/ecommerce`, ecommerceRouter);
app.use(`${v1}/barcodes`, barcodesRouter);
app.use(`${v1}/custom-fields`, customFieldsRouter);
app.use(`${v1}/batches`, batchesRouter);
app.use(`${v1}/serial-numbers`, serialNumbersRouter);
app.use(`${v1}/bin-locations`, binLocationsRouter);
app.use(`${v1}/users`, usersRouter);
app.use(`${v1}/additional-costs`, additionalCostsRouter);
app.use(`${v1}/outsourced-po-recipe-rows`, outsourcedPORouter);
app.use(`${v1}/accounting-metadata`, accountingMetadataRouter);
app.use(`${v1}/quotes`, quotesRouter);
app.use(`${v1}/insights`, insightsRouter);
app.use(`${v1}/planning`, planningRouter);

app.use(errorHandler);

app.listen(env.PORT, () => console.log(`ForgeERP API running on port ${env.PORT}`));

export default app;
